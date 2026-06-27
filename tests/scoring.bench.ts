import { bench, describe } from "vitest";
import { scoreProduct, scoreCatalog } from "../app/scoring";
import { WEAK_PRODUCT, STRONG_PRODUCT } from "./fixtures";

// Throughput of the rule-based scoring engine — the hot path of every scan.
const catalog = Array.from({ length: 1000 }, (_, i) =>
  i % 2 === 0 ? WEAK_PRODUCT : STRONG_PRODUCT,
);

describe("scoring engine", () => {
  bench("scoreProduct — single product", () => {
    scoreProduct(WEAK_PRODUCT);
  });

  bench("scoreCatalog — 1,000 products", () => {
    scoreCatalog(catalog);
  });
});
