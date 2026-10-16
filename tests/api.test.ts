import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import products from "../data/products.json";
import expected from "../data/expected.json";

describe("POST /reprice", () => {
  it("returns the fixture results in their original order", async () => {
    const response = await request(app).post("/reprice").send(products);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual(expected);
  });

  it("accepts an empty array", async () => {
    const response = await request(app).post("/reprice").send([]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("keeps separate results for duplicate SKUs", async () => {
    const response = await request(app).post("/reprice").send([
      products[0], { ...products[0], competitors: [] },
    ]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expected[0],
      { sku: products[0].sku, oldPrice: products[0].myPrice, newPrice: products[0].maxPrice, reason: "NO_COMPETITORS" },
    ]);
  });

  it.each([{}, null, "hello", 42, true])("rejects a non-array body: %j", async (body) => {
    const response = await request(app).post("/reprice")
      .set("Content-Type", "application/json").send(JSON.stringify(body));
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  it.each([
    { sku: 123 },
    { name: null },
    { myPrice: -1 },
    { myPrice: "100" },
    { minPrice: 1.5 },
    { maxPrice: 2.5 },
    { minPrice: 500_000, maxPrice: 100 },
    { step: -0.5 },
    { step: null },
    { competitors: null },
    { competitors: [{ seller: "Shop", price: -1, inStock: true }] },
    { competitors: [{ seller: "Shop", price: 100, inStock: "true" }] },
    { competitors: [{ price: 100, inStock: true }] },
  ])("rejects invalid product fields: %j", async (changes) => {
    const response = await request(app).post("/reprice")
      .send([{ ...products[0], ...changes }]);
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  it.each([{ item: null }, { item: {} }, { item: 1 }, { item: [] }])("rejects an invalid array item: $item", async ({ item }) => {
    const response = await request(app).post("/reprice").send([products[0], item]);
    expect(response.status).toBe(400);
  });

  it("rejects numbers outside the finite range", async () => {
    const body = JSON.stringify([products[0]]).replace('"step":10', '"step":1e400');
    const response = await request(app).post("/reprice")
      .set("Content-Type", "application/json").send(body);
    expect(response.status).toBe(400);
  });

  it("reports malformed JSON as a client error", async () => {
    const response = await request(app).post("/reprice")
      .set("Content-Type", "application/json").send("[{broken");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Некорректный JSON." });
  });

  it("rejects a missing JSON body", async () => {
    const response = await request(app).post("/reprice");
    expect(response.status).toBe(400);
  });

  it("limits the request size", async () => {
    const response = await request(app).post("/reprice")
      .send([{ ...products[0], name: "x".repeat(1024 * 1024) }]);
    expect(response.status).toBe(413);
    expect(response.body).toHaveProperty("error");
  });
});
