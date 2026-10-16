import type { Competitor, Product } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isCompetitor(value: unknown): value is Competitor {
  return (
    isRecord(value) &&
    typeof value.seller === "string" &&
    isPrice(value.price) &&
    typeof value.inStock === "boolean"
  );
}

function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.sku === "string" &&
    typeof value.name === "string" &&
    isPrice(value.myPrice) &&
    isPrice(value.minPrice) &&
    Number.isInteger(value.minPrice) &&
    isPrice(value.maxPrice) &&
    Number.isInteger(value.maxPrice) &&
    value.minPrice <= value.maxPrice &&
    isPrice(value.step) &&
    Array.isArray(value.competitors) &&
    value.competitors.every(isCompetitor)
  );
}

export function isProductArray(value: unknown): value is Product[] {
  return Array.isArray(value) && value.every(isProduct);
}
