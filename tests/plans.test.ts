import { describe, it, expect } from "vitest";
import { getPlan, PLANS } from "../app/billing/plans";

describe("getPlan", () => {
  it("returns the named plan", () => {
    expect(getPlan("growth").name).toBe("growth");
    expect(getPlan("pro").scanLimit).toBe(100000);
  });

  it("falls back to free for unknown/empty", () => {
    expect(getPlan(undefined).name).toBe("free");
    expect(getPlan(null).name).toBe("free");
    expect(getPlan("enterprise").name).toBe("free");
  });
});

describe("plan entitlements", () => {
  it("free cannot generate/apply/bulk", () => {
    expect(PLANS.free.canGenerateFixes).toBe(false);
    expect(PLANS.free.canApplySingle).toBe(false);
    expect(PLANS.free.canBulkApply).toBe(false);
  });

  it("starter can generate + apply single but not bulk", () => {
    expect(PLANS.starter.canGenerateFixes).toBe(true);
    expect(PLANS.starter.canApplySingle).toBe(true);
    expect(PLANS.starter.canBulkApply).toBe(false);
  });

  it("growth and pro can bulk apply; scan limits ascend", () => {
    expect(PLANS.growth.canBulkApply).toBe(true);
    expect(PLANS.pro.canBulkApply).toBe(true);
    expect(PLANS.free.scanLimit).toBeLessThan(PLANS.starter.scanLimit);
    expect(PLANS.starter.scanLimit).toBeLessThan(PLANS.growth.scanLimit);
    expect(PLANS.growth.scanLimit).toBeLessThan(PLANS.pro.scanLimit);
  });
});
