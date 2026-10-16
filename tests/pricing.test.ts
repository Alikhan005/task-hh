import { describe, expect, it } from "vitest";
import products from "../data/products.json";
import expected from "../data/expected.json";
import { calculatePrice } from "../src/pricing.js";
import type { Product, Reason } from "../src/types.js";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    sku: "TEST-1",
    name: "Test product",
    myPrice: 180,
    minPrice: 100,
    maxPrice: 200,
    step: 10,
    competitors: [{ seller: "Shop", price: 160, inStock: true }],
    ...overrides,
  };
}

describe("calculatePrice", () => {
  it("matches all results from the task fixture", () => {
    expect(products.map(calculatePrice)).toEqual(expected);
  });

  const cases: {
    name: string;
    overrides: Partial<Product>;
    newPrice: number;
    reason: Reason;
  }[] = [
    { name: "undercuts an available competitor", overrides: {}, newPrice: 150, reason: "UNDERCUT" },
    { name: "handles an empty competitor list", overrides: { competitors: [] }, newPrice: 200, reason: "NO_COMPETITORS" },
    { name: "ignores all unavailable competitors", overrides: { competitors: [{ seller: "Shop", price: 1, inStock: false }] }, newPrice: 200, reason: "NO_COMPETITORS" },
    { name: "stops at the lower bound", overrides: { minPrice: 155 }, newPrice: 155, reason: "AT_MIN" },
    { name: "stops at the upper bound", overrides: { maxPrice: 140 }, newPrice: 140, reason: "AT_MAX" },
    { name: "keeps UNDERCUT at the exact minimum", overrides: { minPrice: 150 }, newPrice: 150, reason: "UNDERCUT" },
    { name: "keeps UNDERCUT at the exact maximum", overrides: { maxPrice: 150 }, newPrice: 150, reason: "UNDERCUT" },
    { name: "accepts a zero step", overrides: { step: 0 }, newPrice: 160, reason: "UNDERCUT" },
    { name: "rounds a fractional candidate down", overrides: { step: 0.5, competitors: [{ seller: "Shop", price: 160.9, inStock: true }] }, newPrice: 160, reason: "UNDERCUT" },
    { name: "rounds even when the step is zero", overrides: { step: 0, competitors: [{ seller: "Shop", price: 160.9, inStock: true }] }, newPrice: 160, reason: "UNDERCUT" },
    { name: "clamps a negative candidate", overrides: { step: 300 }, newPrice: 100, reason: "AT_MIN" },
    { name: "handles a fixed range", overrides: { minPrice: 150, maxPrice: 150 }, newPrice: 150, reason: "UNDERCUT" },
    { name: "handles zero prices", overrides: { minPrice: 0, step: 0, competitors: [{ seller: "Shop", price: 0, inStock: true }] }, newPrice: 0, reason: "UNDERCUT" },
    { name: "returns the maximum without competitors even for a fixed range", overrides: { minPrice: 0, maxPrice: 0, competitors: [] }, newPrice: 0, reason: "NO_COMPETITORS" },
  ];

  it.each(cases)("$name", ({ overrides, newPrice, reason }) => {
    expect(calculatePrice(makeProduct(overrides))).toEqual({
      sku: "TEST-1",
      oldPrice: 180,
      newPrice,
      reason,
    });
  });

  it("uses the cheapest available price and handles tied competitors", () => {
    const product = makeProduct({
      competitors: [
        { seller: "Unavailable", price: 0, inStock: false },
        { seller: "Expensive", price: 190, inStock: true },
        { seller: "First", price: 140, inStock: true },
        { seller: "Second", price: 140, inStock: true },
      ],
    });
    expect(calculatePrice(product).newPrice).toBe(130);
  });

  it.each([0, 99.5, 9999])("preserves oldPrice=%s without using it in the calculation", (myPrice) => {
    expect(calculatePrice(makeProduct({ myPrice }))).toEqual({
      sku: "TEST-1", oldPrice: myPrice, newPrice: 150, reason: "UNDERCUT",
    });
  });

  it("does not mutate the product or its competitors", () => {
    const product = makeProduct();
    const before = structuredClone(product);
    product.competitors.forEach(Object.freeze);
    Object.freeze(product.competitors);
    Object.freeze(product);
    expect(calculatePrice(product)).toEqual(calculatePrice(product));
    expect(product).toEqual(before);
  });

  it("handles a large list without spreading it into Math.min", () => {
    const competitors = Array.from({ length: 150_000 }, (_, index) => ({
      seller: String(index), price: 160 + index, inStock: true,
    }));
    expect(calculatePrice(makeProduct({ competitors })).newPrice).toBe(150);
  });
});
