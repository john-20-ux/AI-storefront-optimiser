import prisma from "../db.server";

/**
 * Ensure a Shop + ScanSettings row exists for this shop domain.
 * Stores only minimal metadata — never catalog, customer, or order data.
 */
export async function ensureShop(shopDomain: string) {
  const shop = await prisma.shop.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain },
  });

  await prisma.scanSettings.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain },
  });

  return shop;
}

export async function getScanSummary(shopDomain: string) {
  return prisma.scanSummary.findUnique({ where: { shopDomain } });
}

export async function getScanSettings(shopDomain: string) {
  return prisma.scanSettings.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain },
  });
}

// Aggregate issue tallies persisted on ScanSummary. Open-ended (Record) so it is
// assignable to Prisma's Json input type. Known keys: missingSeo, missingAlt,
// missingCategory, weakDescription, variantIssues, critical.
export type IssueCounts = Record<string, number>;

/**
 * Persist aggregate scan results only. No per-product data is stored.
 */
export async function saveScanSummary(
  shopDomain: string,
  data: {
    totalProductsScanned: number;
    averageScore: number;
    issueCounts: IssueCounts;
    lastScanAt: Date;
  },
) {
  return prisma.scanSummary.upsert({
    where: { shopDomain },
    update: data,
    create: { shopDomain, ...data },
  });
}
