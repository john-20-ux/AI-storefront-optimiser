import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  ensureShop,
  getScanSettings,
  getScanSummary,
  saveScanSummary,
} from "../../app/lib/shop.server";
import { prisma, resetDb } from "../setup/db";

const SHOP = "demo.myshopify.com";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("shop.server (DB)", () => {
  it("ensureShop creates shop + settings and is idempotent", async () => {
    await ensureShop(SHOP);
    await ensureShop(SHOP);
    expect(await prisma.shop.count()).toBe(1);
    expect(await prisma.scanSettings.count()).toBe(1);
    const shop = await prisma.shop.findUnique({ where: { shopDomain: SHOP } });
    expect(shop?.planName).toBe("free");
  });

  it("getScanSettings returns defaults", async () => {
    const s = await getScanSettings(SHOP);
    expect(s.tonePreference).toBe("simple");
    expect(s.targetAudience).toBe("general");
    expect(s.aiRule).toBe("balanced");
  });

  it("saveScanSummary upserts aggregates", async () => {
    const at = new Date();
    await saveScanSummary(SHOP, {
      totalProductsScanned: 10,
      averageScore: 62,
      issueCounts: { critical: 3, missingSeo: 5 },
      lastScanAt: at,
    });
    let sum = await getScanSummary(SHOP);
    expect(sum?.averageScore).toBe(62);
    expect((sum?.issueCounts as any).critical).toBe(3);

    await saveScanSummary(SHOP, {
      totalProductsScanned: 12,
      averageScore: 80,
      issueCounts: { critical: 1 },
      lastScanAt: at,
    });
    sum = await getScanSummary(SHOP);
    expect(sum?.averageScore).toBe(80);
    expect(sum?.totalProductsScanned).toBe(12);
    expect(await prisma.scanSummary.count()).toBe(1);
  });
});
