import type { Product, PriceResult } from "./types.js";

export function calculatePrice(product: Product): PriceResult {
  let best = Infinity;

  for (const competitor of product.competitors) {
    if (competitor.inStock && competitor.price < best) {
      best = competitor.price;
    }
  }

  const result = { sku: product.sku, oldPrice: product.myPrice };

  if (best === Infinity) {
    return { ...result, newPrice: product.maxPrice, reason: "NO_COMPETITORS" };
  }

  const candidate = Math.floor(best - product.step);

  if (candidate < product.minPrice) {
    return { ...result, newPrice: product.minPrice, reason: "AT_MIN" };
  }

  if (candidate > product.maxPrice) {
    return { ...result, newPrice: product.maxPrice, reason: "AT_MAX" };
  }

  return { ...result, newPrice: candidate, reason: "UNDERCUT" };
}
