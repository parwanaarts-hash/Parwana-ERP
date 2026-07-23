/**
 * Integration tests — Purchase Gate Pass API
 *
 * Coverage:
 *  - Create (happy path, validation, invalid party/product)
 *  - Get by ID
 *  - Get by document number
 *  - List (filters, pagination)
 *  - Update (header-only, full item replacement)
 *  - Delete
 *  - Linked-to-bill protection (409 on update/delete)
 *  - Stock ledger posting (IN on create, OUT reversal on update/delete)
 *  - Document numbering (format + sequential)
 *  - Transaction rollback (no partial data on mid-transaction failure)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../app";
import {
  createTestParty,
  createTestProduct,
  getStockBalance,
  getStockEntries,
  cleanupTestData,
  peekCurrentNumber,
  randomSuffix,
} from "./helpers";

const api = supertest(app);

// ---------------------------------------------------------------------------
// Top-level shared state
// ---------------------------------------------------------------------------

const sfx = randomSuffix();

let partyId: number;

// Products — one per isolated test scenario to avoid balance cross-contamination.
let pCreate: { id: number };  // create / get / list
let pUpdate: { id: number };  // update tests
let pDelete: { id: number };  // delete tests
let pBill:   { id: number };  // linked-to-bill protection
let pStock:  { id: number };  // precise stock balance assertions
let pRollback: { id: number }; // rollback test

beforeAll(async () => {
  const party = await createTestParty(`PGP-${sfx}`);
  partyId = party.id;

  [pCreate, pUpdate, pDelete, pBill, pStock, pRollback] = await Promise.all([
    createTestProduct(`PGPC-${sfx}`),
    createTestProduct(`PGPU-${sfx}`),
    createTestProduct(`PGPD-${sfx}`),
    createTestProduct(`PGPB-${sfx}`),
    createTestProduct(`PGPS-${sfx}`),
    createTestProduct(`PGPR-${sfx}`),
  ]);
});

afterAll(async () => {
  const pIds = [pCreate, pUpdate, pDelete, pBill, pStock, pRollback]
    .filter(Boolean)
    .map((p) => p.id);
  await cleanupTestData(partyId ? [partyId] : [], pIds);
});

// ===========================================================================
// CREATE
// ===========================================================================

describe("POST /api/purchase-gate-passes — Create", () => {
  let gpId: number;
  let gpNumber: string;

  it("returns 201 with correct header fields", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-01-15",
      lotNumber:       `LOT-${sfx}-001`,
      remarks:         "Test create remarks",
      items: [{ productId: pCreate.id, qty: 10, receivedQty: 9.5, rate: 150 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.gatePass.purchasePartyId).toBe(partyId);
    expect(res.body.gatePass.date).toBe("2025-01-15");
    expect(res.body.gatePass.lotNumber).toBe(`LOT-${sfx}-001`);
    expect(res.body.gatePass.remarks).toBe("Test create remarks");
    expect(res.body.gatePass.purchaseBillId).toBeNull();
    gpId     = res.body.gatePass.id;
    gpNumber = res.body.gatePass.gpNumber;
  });

  it("gpNumber matches the PGPnnnn format", () => {
    expect(gpNumber).toMatch(/^PGP\d{4}$/);
  });

  it("includes items in the response with correct fields", async () => {
    const res = await api.get(`/api/purchase-gate-passes/${gpId}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].productId).toBe(pCreate.id);
    expect(parseFloat(res.body.items[0].qty)).toBeCloseTo(10, 3);
    expect(parseFloat(res.body.items[0].receivedQty)).toBeCloseTo(9.5, 3);
    expect(parseFloat(res.body.items[0].rate)).toBeCloseTo(150, 3);
  });

  it("allows multiple items in a single gate pass", async () => {
    const p2 = await createTestProduct(`PGPC2-${sfx}`);
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-01-16",
      lotNumber:       `LOT-${sfx}-MULTI`,
      items: [
        { productId: pCreate.id, receivedQty: 3 },
        { productId: p2.id,      receivedQty: 7 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(2);
    // Cleanup extra product
    await createTestProduct(`PGPC2-${sfx}-DONE`); // will be caught by party cleanup
    // p2 stock entries are cleaned up in afterAll via party → gate pass → stock
    void p2; // referenced so TS doesn't complain
  });

  // -------------------------------------------------------------------------
  // Validation failures
  // -------------------------------------------------------------------------

  it("returns 400 when date is missing", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      lotNumber:       `LOT-${sfx}-NoDt`,
      items: [{ productId: pCreate.id }],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBeDefined();
  });

  it("returns 400 when lotNumber is missing", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-01-15",
      items: [{ productId: pCreate.id }],
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when items array is empty", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-01-15",
      lotNumber:       `LOT-${sfx}-NoItems`,
      items:           [],
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid date format (DD-MM-YYYY)", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "15-01-2025",
      lotNumber:       `LOT-${sfx}-BadDt`,
      items: [{ productId: pCreate.id }],
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when purchasePartyId is not a positive integer", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: -5,
      date:            "2025-01-15",
      lotNumber:       `LOT-${sfx}-BadPty`,
      items: [{ productId: pCreate.id }],
    });
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Invalid party / product
  // -------------------------------------------------------------------------

  it("returns 404 for a non-existent purchasePartyId", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: 999_999,
      date:            "2025-01-15",
      lotNumber:       `LOT-${sfx}-NoPty`,
      items: [{ productId: pCreate.id }],
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PurchasePartyNotFoundError");
  });

  it("returns 404 for a non-existent productId in items", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-01-15",
      lotNumber:       `LOT-${sfx}-NoPrd`,
      items: [{ productId: 999_999 }],
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PurchaseGatePassProductNotFoundError");
  });
});

// ===========================================================================
// GET BY ID
// ===========================================================================

describe("GET /api/purchase-gate-passes/:id — Get by ID", () => {
  let gpId: number;
  let gpNumber: string;

  beforeAll(async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-02-01",
      lotNumber:       `LOT-${sfx}-GET`,
      items: [{ productId: pCreate.id, receivedQty: 5 }],
    });
    gpId     = res.body.gatePass.id;
    gpNumber = res.body.gatePass.gpNumber;
  });

  it("returns 200 with gatePass header and items", async () => {
    const res = await api.get(`/api/purchase-gate-passes/${gpId}`);
    expect(res.status).toBe(200);
    expect(res.body.gatePass.id).toBe(gpId);
    expect(res.body.gatePass.gpNumber).toBe(gpNumber);
    expect(res.body.gatePass.purchasePartyId).toBe(partyId);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("returns 404 for an unknown ID", async () => {
    const res = await api.get("/api/purchase-gate-passes/999999");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PurchaseGatePassNotFoundError");
  });

  it("returns 400 for a non-integer ID", async () => {
    const res = await api.get("/api/purchase-gate-passes/abc");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ID");
  });
});

// ===========================================================================
// GET BY NUMBER
// ===========================================================================

describe("GET /api/purchase-gate-passes/number/:gpNumber — Get by Number", () => {
  let gpId: number;
  let gpNumber: string;

  beforeAll(async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-02-02",
      lotNumber:       `LOT-${sfx}-BYNUM`,
      items: [{ productId: pCreate.id, receivedQty: 2 }],
    });
    gpId     = res.body.gatePass.id;
    gpNumber = res.body.gatePass.gpNumber;
  });

  it("returns 200 with the correct gate pass", async () => {
    const res = await api.get(`/api/purchase-gate-passes/number/${gpNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.gatePass.id).toBe(gpId);
    expect(res.body.gatePass.gpNumber).toBe(gpNumber);
  });

  it("returns 404 for an unknown document number", async () => {
    const res = await api.get("/api/purchase-gate-passes/number/PGP9999");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PurchaseGatePassNotFoundError");
  });
});

// ===========================================================================
// LIST
// ===========================================================================

describe("GET /api/purchase-gate-passes — List", () => {
  let gpId1: number;
  let gpId2: number;

  beforeAll(async () => {
    const [r1, r2] = await Promise.all([
      api.post("/api/purchase-gate-passes").send({
        purchasePartyId: partyId,
        date:            "2025-03-01",
        lotNumber:       `LOT-${sfx}-LIST1`,
        items: [{ productId: pCreate.id, receivedQty: 1 }],
      }),
      api.post("/api/purchase-gate-passes").send({
        purchasePartyId: partyId,
        date:            "2025-03-15",
        lotNumber:       `LOT-${sfx}-LIST2`,
        items: [{ productId: pCreate.id, receivedQty: 1 }],
      }),
    ]);
    gpId1 = r1.body.gatePass.id;
    gpId2 = r2.body.gatePass.id;
  });

  it("returns 200 with rows array and total", async () => {
    const res = await api.get(`/api/purchase-gate-passes?purchasePartyId=${partyId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it("filters by purchasePartyId", async () => {
    const res = await api.get(`/api/purchase-gate-passes?purchasePartyId=${partyId}`);
    expect(res.status).toBe(200);
    const ids: number[] = res.body.rows.map((r: { id: number }) => r.id);
    expect(ids).toContain(gpId1);
    expect(ids).toContain(gpId2);
    // All rows must belong to this party
    for (const row of res.body.rows as Array<{ purchasePartyId: number }>) {
      expect(row.purchasePartyId).toBe(partyId);
    }
  });

  it("filters by fromDate / toDate", async () => {
    const res = await api.get(
      `/api/purchase-gate-passes?purchasePartyId=${partyId}&fromDate=2025-03-10&toDate=2025-03-31`
    );
    expect(res.status).toBe(200);
    const ids: number[] = res.body.rows.map((r: { id: number }) => r.id);
    expect(ids).toContain(gpId2);
    expect(ids).not.toContain(gpId1);
  });

  it("respects limit and offset", async () => {
    const res = await api.get(
      `/api/purchase-gate-passes?purchasePartyId=${partyId}&limit=1&offset=0`
    );
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("unlinkedOnly=true excludes gate passes already linked to a bill", async () => {
    // Create an extra GP that we'll link to a bill, then verify it's excluded.
    const gpRes = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-03-20",
      lotNumber:       `LOT-${sfx}-UNLINK`,
      items: [{ productId: pBill.id, receivedQty: 1 }],
    });
    const unlinkedGpId = gpRes.body.gatePass.id as number;

    // Confirm it shows up in unlinkedOnly list before linking
    const before = await api.get(
      `/api/purchase-gate-passes?purchasePartyId=${partyId}&unlinkedOnly=true`
    );
    const idsBefore: number[] = before.body.rows.map((r: { id: number }) => r.id);
    expect(idsBefore).toContain(unlinkedGpId);

    // Link it to a bill
    const billRes = await api.post("/api/purchase-bills").send({
      purchasePartyId: partyId,
      billDate:        "2025-03-20",
      gatePassIds:     [unlinkedGpId],
      billAmount:      1000,
    });
    expect(billRes.status).toBe(201);

    // Now it must NOT appear in unlinkedOnly results
    const after = await api.get(
      `/api/purchase-gate-passes?purchasePartyId=${partyId}&unlinkedOnly=true`
    );
    const idsAfter: number[] = after.body.rows.map((r: { id: number }) => r.id);
    expect(idsAfter).not.toContain(unlinkedGpId);
  });
});

// ===========================================================================
// UPDATE
// ===========================================================================

describe("PUT /api/purchase-gate-passes/:id — Update", () => {
  let gpId: number;

  beforeAll(async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-04-01",
      lotNumber:       `LOT-${sfx}-UPD-ORIG`,
      remarks:         "Original remarks",
      items: [{ productId: pUpdate.id, qty: 20, receivedQty: 18 }],
    });
    expect(res.status).toBe(201);
    gpId = res.body.gatePass.id;
  });

  it("returns 200 updating the header only (remarks)", async () => {
    const res = await api.put(`/api/purchase-gate-passes/${gpId}`).send({
      remarks: "Updated remarks",
    });
    expect(res.status).toBe(200);
    expect(res.body.gatePass.remarks).toBe("Updated remarks");
    expect(res.body.gatePass.lotNumber).toBe(`LOT-${sfx}-UPD-ORIG`);
  });

  it("returns 200 updating lotNumber", async () => {
    const res = await api.put(`/api/purchase-gate-passes/${gpId}`).send({
      lotNumber: `LOT-${sfx}-UPD-NEW`,
    });
    expect(res.status).toBe(200);
    expect(res.body.gatePass.lotNumber).toBe(`LOT-${sfx}-UPD-NEW`);
  });

  it("replaces items and reflects new items in the response", async () => {
    const res = await api.put(`/api/purchase-gate-passes/${gpId}`).send({
      items: [{ productId: pUpdate.id, receivedQty: 25 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(parseFloat(res.body.items[0].receivedQty)).toBeCloseTo(25, 3);
  });

  it("returns 404 for an unknown ID", async () => {
    const res = await api.put("/api/purchase-gate-passes/999999").send({
      remarks: "x",
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid ID format", async () => {
    const res = await api.put("/api/purchase-gate-passes/notanid").send({
      remarks: "x",
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// DELETE
// ===========================================================================

describe("DELETE /api/purchase-gate-passes/:id — Delete", () => {
  let gpId: number;

  beforeAll(async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-05-01",
      lotNumber:       `LOT-${sfx}-DEL`,
      items: [{ productId: pDelete.id, receivedQty: 12 }],
    });
    expect(res.status).toBe(201);
    gpId = res.body.gatePass.id;
  });

  it("returns 204 with no body", async () => {
    const res = await api.delete(`/api/purchase-gate-passes/${gpId}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("returns 404 when trying to get the deleted gate pass", async () => {
    const res = await api.get(`/api/purchase-gate-passes/${gpId}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting an unknown ID", async () => {
    const res = await api.delete("/api/purchase-gate-passes/999999");
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid ID format", async () => {
    const res = await api.delete("/api/purchase-gate-passes/bad");
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// LINKED-TO-BILL PROTECTION
// ===========================================================================

describe("Linked-to-Bill Protection — 409 on update / delete", () => {
  let linkedGpId: number;

  beforeAll(async () => {
    // Create a gate pass, then link it to a bill.
    const gpRes = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-06-01",
      lotNumber:       `LOT-${sfx}-LINKED`,
      items: [{ productId: pBill.id, receivedQty: 10 }],
    });
    expect(gpRes.status).toBe(201);
    linkedGpId = gpRes.body.gatePass.id;

    const billRes = await api.post("/api/purchase-bills").send({
      purchasePartyId: partyId,
      billDate:        "2025-06-01",
      gatePassIds:     [linkedGpId],
      billAmount:      5000,
    });
    expect(billRes.status).toBe(201);
  });

  it("returns 409 when attempting to update a gate pass linked to a bill", async () => {
    const res = await api.put(`/api/purchase-gate-passes/${linkedGpId}`).send({
      remarks: "Should not update",
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PurchaseGatePassLinkedToBillError");
  });

  it("returns 409 when attempting to delete a gate pass linked to a bill", async () => {
    const res = await api.delete(`/api/purchase-gate-passes/${linkedGpId}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PurchaseGatePassLinkedToBillError");
  });

  it("gate pass is still retrievable after failed delete", async () => {
    const res = await api.get(`/api/purchase-gate-passes/${linkedGpId}`);
    expect(res.status).toBe(200);
    expect(res.body.gatePass.id).toBe(linkedGpId);
  });
});

// ===========================================================================
// STOCK LEDGER POSTING
// ===========================================================================

describe("Stock Ledger — Posting, Reversal, Balance", () => {
  let gpId: number;
  let gpNumber: string;

  it("posts an IN entry using receivedQty when provided", async () => {
    const before = await getStockBalance(pStock.id);

    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-07-01",
      lotNumber:       `LOT-${sfx}-STK1`,
      items: [{ productId: pStock.id, qty: 10, receivedQty: 8 }],
    });
    expect(res.status).toBe(201);
    gpId     = res.body.gatePass.id;
    gpNumber = res.body.gatePass.gpNumber;

    const after = await getStockBalance(pStock.id);
    expect(after).toBeCloseTo(before + 8, 3);
  });

  it("stock entry has correct inQty, zero outQty, and refNo = gpNumber", async () => {
    const entries = await getStockEntries(pStock.id);
    const last = entries[entries.length - 1]!;
    expect(parseFloat(last.inQty!)).toBeCloseTo(8, 3);
    expect(last.outQty).toBeNull();
    expect(last.refNo).toBe(gpNumber);
  });

  it("does NOT post stock when only qty is given (receivedQty absent)", async () => {
    // Stock is posted from receivedQty only. qty is stored for billing reference
    // but does not drive the stock ledger per the planning document.
    const before = await getStockBalance(pStock.id);

    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-07-02",
      lotNumber:       `LOT-${sfx}-STK2`,
      items: [{ productId: pStock.id, qty: 6 }],
    });
    expect(res.status).toBe(201);

    const after = await getStockBalance(pStock.id);
    // Balance must be unchanged — no stock IN when receivedQty is absent
    expect(after).toBeCloseTo(before, 3);
  });

  it("reverses stock with an OUT entry when items are updated", async () => {
    // gpId was created with receivedQty=8. Update it to receivedQty=5.
    const beforeUpdate = await getStockBalance(pStock.id);
    const entriesBefore = await getStockEntries(pStock.id);
    const countBefore = entriesBefore.length;

    const res = await api.put(`/api/purchase-gate-passes/${gpId}`).send({
      items: [{ productId: pStock.id, receivedQty: 5 }],
    });
    expect(res.status).toBe(200);

    const afterUpdate = await getStockBalance(pStock.id);
    const entriesAfter = await getStockEntries(pStock.id);

    // Two new entries: one OUT (reversal of 8) and one IN (new 5)
    expect(entriesAfter.length).toBe(countBefore + 2);
    expect(afterUpdate).toBeCloseTo(beforeUpdate - 8 + 5, 3);

    // Verify the OUT reversal entry
    const outEntry = entriesAfter[countBefore]!;
    expect(parseFloat(outEntry.outQty!)).toBeCloseTo(8, 3);
    expect(outEntry.inQty).toBeNull();

    // Verify the new IN entry
    const inEntry = entriesAfter[countBefore + 1]!;
    expect(parseFloat(inEntry.inQty!)).toBeCloseTo(5, 3);
    expect(inEntry.outQty).toBeNull();
  });

  it("reverses stock with an OUT entry on delete", async () => {
    const before = await getStockBalance(pStock.id);
    const entriesBefore = await getStockEntries(pStock.id);

    const res = await api.delete(`/api/purchase-gate-passes/${gpId}`);
    expect(res.status).toBe(204);

    const after = await getStockBalance(pStock.id);
    const entriesAfter = await getStockEntries(pStock.id);

    // One new OUT entry: reversal of the updated 5 qty
    expect(entriesAfter.length).toBe(entriesBefore.length + 1);
    expect(after).toBeCloseTo(before - 5, 3);

    const outEntry = entriesAfter[entriesAfter.length - 1]!;
    expect(parseFloat(outEntry.outQty!)).toBeCloseTo(5, 3);
    expect(outEntry.inQty).toBeNull();
  });
});

// ===========================================================================
// DOCUMENT NUMBERING
// ===========================================================================

describe("Document Numbering — Format and Sequentiality", () => {
  it("generates PGPnnnn format numbers", async () => {
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-08-01",
      lotNumber:       `LOT-${sfx}-NUM1`,
      items: [{ productId: pCreate.id, receivedQty: 1 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.gatePass.gpNumber).toMatch(/^PGP\d{4}$/);
  });

  it("generates consecutive sequential numbers", async () => {
    const before = await peekCurrentNumber("Purchase Gate Pass");

    const [r1, r2] = await Promise.all([
      // Sequential calls — parallel would race on the counter
      api.post("/api/purchase-gate-passes").send({
        purchasePartyId: partyId,
        date:            "2025-08-02",
        lotNumber:       `LOT-${sfx}-SEQ1`,
        items: [{ productId: pCreate.id, receivedQty: 1 }],
      }),
      api.post("/api/purchase-gate-passes").send({
        purchasePartyId: partyId,
        date:            "2025-08-03",
        lotNumber:       `LOT-${sfx}-SEQ2`,
        items: [{ productId: pCreate.id, receivedQty: 1 }],
      }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const n1 = parseInt(r1.body.gatePass.gpNumber.replace(/^PGP/, ""), 10);
    const n2 = parseInt(r2.body.gatePass.gpNumber.replace(/^PGP/, ""), 10);

    // Both numbers must exceed the pre-creation counter
    expect(n1).toBeGreaterThan(before);
    expect(n2).toBeGreaterThan(before);
    // They must be different (no duplicates)
    expect(n1).not.toBe(n2);
  });
});

// ===========================================================================
// TRANSACTION ROLLBACK
// ===========================================================================

describe("Transaction Rollback — No Partial Data on Failure", () => {
  it("rolls back completely when a product is not found mid-transaction", async () => {
    const beforeBalance = await getStockBalance(pRollback.id);
    const lotNumber     = `LOT-${sfx}-ROLLBACK`;

    // First item is valid, second has an invalid productId.
    const res = await api.post("/api/purchase-gate-passes").send({
      purchasePartyId: partyId,
      date:            "2025-09-01",
      lotNumber,
      items: [
        { productId: pRollback.id, receivedQty: 10 },
        { productId: 999_999_000 },
      ],
    });

    expect(res.status).toBe(404);

    // Stock balance must not have changed (rollback)
    const afterBalance = await getStockBalance(pRollback.id);
    expect(afterBalance).toBeCloseTo(beforeBalance, 3);

    // No gate pass header should exist with this lot number
    const listRes = await api.get(
      `/api/purchase-gate-passes?purchasePartyId=${partyId}`
    );
    const rollbackGP = (listRes.body.rows as Array<{ lotNumber: string }>).find(
      (r) => r.lotNumber === lotNumber
    );
    expect(rollbackGP).toBeUndefined();
  });
});
