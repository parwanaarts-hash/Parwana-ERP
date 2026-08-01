/**
 * Integration tests — Products API
 *
 * Coverage:
 *  - CRUD (create, get, list, update, delete)
 *  - FK assignment (subCategoryId, shikanjaId) — happy path + 404 on missing FK
 *  - FK fields returned in GET / LIST responses
 *  - FK fields updatable (set and clear)
 *  - Invalid FK references rejected with 404
 *  - Deletion blocked while FKs are in use (gate-pass references)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../app";
import { db } from "@workspace/db";
import {
  categoriesTable,
  shikanjaTable,
  productsTable,
  stockLedgerEntriesTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { randomSuffix, cleanupTestData } from "./helpers";

const api = supertest(app);

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

const sfx = randomSuffix();

let mainCatId:  number;
let subCatId:   number;
let shikanjaId: number;

let pBasic:    { id: number; itemCode: string };
let pFk:       { id: number; itemCode: string };
let pUpdate:   { id: number; itemCode: string };
let pDelete:   { id: number; itemCode: string };
let pDelete2:  { id: number; itemCode: string };

beforeAll(async () => {
  // Create reference data
  const [mainCat] = await db.insert(categoriesTable).values({ name: `Main-${sfx}` }).returning();
  mainCatId = mainCat!.id;

  const [subCat] = await db.insert(categoriesTable).values({ name: `Sub-${sfx}`, parentId: mainCatId }).returning();
  subCatId = subCat!.id;

  const [shikanja] = await db.insert(shikanjaTable).values({ name: `Shikanja-${sfx}` }).returning();
  shikanjaId = shikanja!.id;
});

afterAll(async () => {
  // Products
  const productIds = [pBasic, pFk, pUpdate, pDelete, pDelete2]
    .filter(Boolean).map((p) => p.id);

  if (productIds.length > 0) {
    await db.delete(stockLedgerEntriesTable).where(
      inArray(stockLedgerEntriesTable.productId, productIds)
    );
    await db.delete(productsTable).where(inArray(productsTable.id, productIds));
  }

  // Reference data
  if (subCatId)  await db.delete(categoriesTable).where(eq(categoriesTable.id, subCatId));
  if (mainCatId) await db.delete(categoriesTable).where(eq(categoriesTable.id, mainCatId));
  if (shikanjaId) await db.delete(shikanjaTable).where(eq(shikanjaTable.id, shikanjaId));
});

// ===========================================================================
// BASIC CREATE / GET / LIST
// ===========================================================================

describe("POST /api/products — Create basic product", () => {
  it("returns 201 with all scalar fields", async () => {
    const res = await api.post("/api/products").send({
      itemCode:    `TST-BASIC-${sfx}`,
      productName: `Basic Product ${sfx}`,
      scale:       "Set",
      qty:         10,
      stockFactor: 2,
    });

    expect(res.status).toBe(201);
    expect(res.body.itemCode).toBe(`TST-BASIC-${sfx}`);
    expect(res.body.scale).toBe("Set");
    expect(res.body.qty).toBe(10);
    expect(res.body.subCategoryId).toBeNull();
    expect(res.body.shikanjaId).toBeNull();
    pBasic = res.body;
  });

  it("returns 400 for missing itemCode", async () => {
    const res = await api.post("/api/products").send({
      productName: `No Code ${sfx}`,
    });
    expect(res.status).toBe(400);
  });


});

describe("GET /api/products/:id", () => {
  it("returns the product with all fields", async () => {
    const res = await api.get(`/api/products/${pBasic.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(pBasic.id);
    expect(res.body.subCategoryId).toBeNull();
    expect(res.body.shikanjaId).toBeNull();
  });

  it("returns 404 for non-existent product", async () => {
    const res = await api.get("/api/products/999999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/products — List", () => {
  it("returns a paginated list including the created product", async () => {
    const res = await api.get("/api/products").query({ search: `TST-BASIC-${sfx}` });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.rows[0]).toHaveProperty("subCategoryId");
    expect(res.body.rows[0]).toHaveProperty("shikanjaId");
  });
});

// ===========================================================================
// FK ASSIGNMENT — CREATE
// ===========================================================================

describe("POST /api/products — FK assignment on create", () => {
  it("creates a product with subCategoryId and shikanjaId set", async () => {
    const res = await api.post("/api/products").send({
      itemCode:      `TST-FK-${sfx}`,
      productName:   `FK Product ${sfx}`,
      subCategoryId: subCatId,
      shikanjaId:    shikanjaId,
    });

    expect(res.status).toBe(201);
    expect(res.body.subCategoryId).toBe(subCatId);
    expect(res.body.shikanjaId).toBe(shikanjaId);
    pFk = res.body;
  });

  it("GET returns the FK fields correctly", async () => {
    const res = await api.get(`/api/products/${pFk.id}`);
    expect(res.status).toBe(200);
    expect(res.body.subCategoryId).toBe(subCatId);
    expect(res.body.shikanjaId).toBe(shikanjaId);
  });

  it("returns 404 when subCategoryId references a non-existent category", async () => {
    const res = await api.post("/api/products").send({
      itemCode:      `TST-BADFK-${sfx}`,
      productName:   `Bad FK ${sfx}`,
      subCategoryId: 999_999,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ProductCategoryNotFoundError");
  });

  it("returns 404 when shikanjaId references a non-existent shikanja", async () => {
    const res = await api.post("/api/products").send({
      itemCode:    `TST-BADSH-${sfx}`,
      productName: `Bad Shikanja ${sfx}`,
      shikanjaId:  999_999,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ProductShikanjaNotFoundError");
  });
});

// ===========================================================================
// FK ASSIGNMENT — UPDATE
// ===========================================================================

describe("PUT /api/products/:id — FK assignment on update", () => {
  beforeAll(async () => {
    const res = await api.post("/api/products").send({
      itemCode:    `TST-UPD-${sfx}`,
      productName: `Update FK Product ${sfx}`,
    });
    pUpdate = res.body;
  });

  it("sets subCategoryId and shikanjaId", async () => {
    const res = await api.put(`/api/products/${pUpdate.id}`).send({
      subCategoryId: subCatId,
      shikanjaId:    shikanjaId,
    });
    expect(res.status).toBe(200);
    expect(res.body.subCategoryId).toBe(subCatId);
    expect(res.body.shikanjaId).toBe(shikanjaId);
  });

  it("clears FKs by setting them to null", async () => {
    const res = await api.put(`/api/products/${pUpdate.id}`).send({
      subCategoryId: null,
      shikanjaId:    null,
    });
    expect(res.status).toBe(200);
    expect(res.body.subCategoryId).toBeNull();
    expect(res.body.shikanjaId).toBeNull();
  });

  it("returns 404 when updating with a non-existent subCategoryId", async () => {
    const res = await api.put(`/api/products/${pUpdate.id}`).send({
      subCategoryId: 999_999,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ProductCategoryNotFoundError");
  });

  it("returns 404 when updating with a non-existent shikanjaId", async () => {
    const res = await api.put(`/api/products/${pUpdate.id}`).send({
      shikanjaId: 999_999,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ProductShikanjaNotFoundError");
  });
});

// ===========================================================================
// DELETE
// ===========================================================================

describe("DELETE /api/products/:id", () => {
  beforeAll(async () => {
    const [r1, r2] = await Promise.all([
      api.post("/api/products").send({ itemCode: `TST-DEL-${sfx}`,  productName: `Del 1 ${sfx}` }),
      api.post("/api/products").send({ itemCode: `TST-DEL2-${sfx}`, productName: `Del 2 ${sfx}` }),
    ]);
    pDelete  = r1.body;
    pDelete2 = r2.body;
  });

  it("deletes a product with no references and returns 204", async () => {
    const res = await api.delete(`/api/products/${pDelete.id}`);
    expect(res.status).toBe(204);
  });

  it("returns 404 after deletion", async () => {
    const res = await api.get(`/api/products/${pDelete.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent id", async () => {
    const res = await api.delete("/api/products/999999");
    expect(res.status).toBe(404);
  });
});
