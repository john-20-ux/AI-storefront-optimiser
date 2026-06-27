import type { GraphqlClient } from "./fetchProducts";

const PRODUCT_UPDATE = `#graphql
  mutation UpdateProduct($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id }
      userErrors { field message }
    }
  }
`;

const FILE_UPDATE = `#graphql
  mutation UpdateFileAlt($files: [FileUpdateInput!]!) {
    fileUpdate(files: $files) {
      files { id }
      userErrors { field message }
    }
  }
`;

// Only the fields the merchant approved are sent (brief §20: update field-by-field).
export interface ProductUpdateFields {
  title?: string;
  descriptionHtml?: string;
  productType?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
}

interface UserError {
  field?: string[] | null;
  message: string;
}

async function userErrors(response: Response, path: string): Promise<string[]> {
  const body: any = await response.json();
  if (body.errors?.length) {
    return body.errors.map((e: any) => e.message);
  }
  const errs: UserError[] = body.data?.[path]?.userErrors ?? [];
  return errs.map((e) => e.message);
}

/**
 * Apply approved product field changes. Returns an array of error messages
 * (empty on success). Sends only the keys present in `fields`.
 */
export async function applyProductUpdate(
  admin: GraphqlClient,
  gid: string,
  fields: ProductUpdateFields,
): Promise<string[]> {
  const product: Record<string, unknown> = { id: gid };
  if (fields.title !== undefined) product.title = fields.title;
  if (fields.descriptionHtml !== undefined) product.descriptionHtml = fields.descriptionHtml;
  if (fields.productType !== undefined) product.productType = fields.productType;
  if (fields.tags !== undefined) product.tags = fields.tags;
  if (fields.seoTitle !== undefined || fields.seoDescription !== undefined) {
    const seo: Record<string, string> = {};
    if (fields.seoTitle !== undefined) seo.title = fields.seoTitle;
    if (fields.seoDescription !== undefined) seo.description = fields.seoDescription;
    product.seo = seo;
  }

  // Nothing but the id → nothing to do.
  if (Object.keys(product).length === 1) return [];

  const response = await admin.graphql(PRODUCT_UPDATE, { variables: { product } });
  return userErrors(response, "productUpdate");
}

/**
 * Update the alt text of a media/file node (requires write_files scope).
 */
export async function applyImageAlt(
  admin: GraphqlClient,
  mediaId: string,
  alt: string,
): Promise<string[]> {
  const response = await admin.graphql(FILE_UPDATE, {
    variables: { files: [{ id: mediaId, alt }] },
  });
  return userErrors(response, "fileUpdate");
}
