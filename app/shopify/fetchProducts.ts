import type {
  ProductInput,
  VariantInput,
  MediaInput,
  OptionInput,
  MetafieldInput,
} from "../scoring/types";
import { PRODUCTS_QUERY, PRODUCT_BY_ID_QUERY } from "./queries";

// Minimal shape of the admin GraphQL client returned by `authenticate.admin`.
export interface GraphqlClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

const PAGE_SIZE = 50;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ThrottleStatus {
  currentlyAvailable: number;
  maximumAvailable: number;
  restoreRate: number;
}

/**
 * Respect the Shopify GraphQL cost limit. If the points left can't cover another
 * page-sized request, wait long enough for the bucket to refill.
 */
async function waitForThrottle(throttle: ThrottleStatus | undefined, lastCost: number) {
  if (!throttle) return;
  const needed = Math.max(lastCost, 100);
  if (throttle.currentlyAvailable >= needed) return;
  const deficit = needed - throttle.currentlyAvailable;
  const seconds = Math.min(10, Math.ceil(deficit / Math.max(1, throttle.restoreRate)));
  await sleep(seconds * 1000);
}

function mapProduct(node: any): ProductInput {
  const variants: VariantInput[] = (node.variants?.nodes ?? []).map((v: any) => ({
    id: v.id,
    title: v.title,
    sku: v.sku ?? null,
    barcode: v.barcode ?? null,
    price: v.price ?? null,
    compareAtPrice: v.compareAtPrice ?? null,
    selectedOptions: (v.selectedOptions ?? []).map((o: any) => ({
      name: o.name,
      value: o.value,
    })),
  }));

  const media: MediaInput[] = (node.media?.nodes ?? []).map((m: any) => ({
    id: m.id,
    alt: m.alt ?? null,
    mediaContentType: m.mediaContentType,
    previewImageUrl: m.preview?.image?.url ?? null,
  }));

  const options: OptionInput[] = (node.options ?? []).map((o: any) => ({
    name: o.name,
    values: (o.optionValues ?? []).map((ov: any) => ov.name),
  }));

  const metafields: MetafieldInput[] = (node.metafields?.nodes ?? []).map((mf: any) => ({
    namespace: mf.namespace,
    key: mf.key,
    value: mf.value,
  }));

  return {
    id: node.id,
    title: node.title ?? "",
    handle: node.handle ?? "",
    status: node.status ?? "ACTIVE",
    vendor: node.vendor ?? null,
    productType: node.productType ?? null,
    tags: node.tags ?? [],
    descriptionHtml: node.descriptionHtml ?? null,
    category: node.category ? { id: node.category.id, name: node.category.name } : null,
    seo: {
      title: node.seo?.title ?? null,
      description: node.seo?.description ?? null,
    },
    onlineStoreUrl: node.onlineStoreUrl ?? null,
    totalInventory: typeof node.totalInventory === "number" ? node.totalInventory : null,
    featuredImageUrl: node.featuredMedia?.preview?.image?.url ?? null,
    variants,
    media,
    options,
    metafields,
  };
}

export interface FetchProductsResult {
  products: ProductInput[];
  scanned: number;
  truncatedAtLimit: boolean;
}

/**
 * Fetch products page-by-page up to `limit` (the plan's scan cap).
 * Throws on GraphQL errors so callers can surface a banner.
 */
export async function fetchProducts(
  admin: GraphqlClient,
  limit: number,
): Promise<FetchProductsResult> {
  const products: ProductInput[] = [];
  let after: string | null = null;
  let hasNextPage = true;
  let lastCost = 100;

  while (hasNextPage && products.length < limit) {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: { first: PAGE_SIZE, after },
    });
    const body: any = await response.json();

    if (body.errors?.length) {
      const message = body.errors.map((e: any) => e.message).join("; ");
      throw new Error(`Shopify GraphQL error: ${message}`);
    }

    const connection = body.data?.products;
    if (!connection) break;

    for (const node of connection.nodes) {
      products.push(mapProduct(node));
      if (products.length >= limit) break;
    }

    hasNextPage = connection.pageInfo?.hasNextPage ?? false;
    after = connection.pageInfo?.endCursor ?? null;

    const cost = body.extensions?.cost;
    lastCost = cost?.requestedQueryCost ?? lastCost;
    await waitForThrottle(cost?.throttleStatus, lastCost);
  }

  return {
    products,
    scanned: products.length,
    truncatedAtLimit: hasNextPage && products.length >= limit,
  };
}

export async function fetchProductById(
  admin: GraphqlClient,
  id: string,
): Promise<ProductInput | null> {
  const response = await admin.graphql(PRODUCT_BY_ID_QUERY, { variables: { id } });
  const body: any = await response.json();
  if (body.errors?.length) {
    const message = body.errors.map((e: any) => e.message).join("; ");
    throw new Error(`Shopify GraphQL error: ${message}`);
  }
  const node = body.data?.product;
  return node ? mapProduct(node) : null;
}
