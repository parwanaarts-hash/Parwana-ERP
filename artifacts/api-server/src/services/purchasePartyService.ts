/**
 * Purchase Party Service
 *
 * Master-data CRUD for purchase_parties (suppliers).
 * No ledger or stock writes — financial history is managed by the
 * transaction modules (Purchase Gate Pass, Purchase Bill, Payment Paid).
 *
 * Delete protection: a purchase party cannot be deleted while it is
 * referenced by any gate pass, bill, payment, or ledger entry.
 */

import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ledgerEntriesTable,
  paymentPaidsTable,
  purchaseBillsTable,
  purchaseGatePassesTable,
  purchasePartiesTable,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchasePartyRow = typeof purchasePartiesTable.$inferSelect;

export interface CreatePurchasePartyInput {
  name: string;
}

export interface UpdatePurchasePartyInput {
  name?: string;
}

export interface ListPurchasePartiesInput {
  search?: string;
  limit?:  number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PurchasePartyNotFoundError extends Error {
  constructor(id: number) {
    super(`Purchase Party not found: id=${id}`);
    this.name = "PurchasePartyNotFoundError";
  }
}

export class PurchasePartyInUseError extends Error {
  constructor(id: number) {
    super(
      `Purchase Party id=${id} cannot be deleted because it is referenced ` +
      "by existing gate passes, bills, payments, or ledger entries."
    );
    this.name = "PurchasePartyInUseError";
  }
}

export class PurchasePartyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchasePartyValidationError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new PurchasePartyValidationError("name is required and cannot be blank.");
  }
  if (name.trim().length > 255) {
    throw new PurchasePartyValidationError("name cannot exceed 255 characters.");
  }
}

async function fetchLocked(tx: Tx, id: number): Promise<PurchasePartyRow> {
  const rows = await tx
    .select()
    .from(purchasePartiesTable)
    .where(eq(purchasePartiesTable.id, id))
    .for("update");
  if (rows.length === 0) throw new PurchasePartyNotFoundError(id);
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createPurchaseParty(
  input: CreatePurchasePartyInput
): Promise<PurchasePartyRow> {
  validateName(input.name);

  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(purchasePartiesTable)
      .values({ name: input.name.trim() })
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updatePurchaseParty(
  id: number,
  input: UpdatePurchasePartyInput
): Promise<PurchasePartyRow> {
  if (input.name !== undefined) validateName(input.name);

  return db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    const rows = await tx
      .update(purchasePartiesTable)
      .set({
        ...(input.name !== undefined && { name: input.name.trim() }),
        updatedAt: new Date(),
      })
      .where(eq(purchasePartiesTable.id, id))
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deletePurchaseParty(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    // Check all referencing tables in parallel.
    const [pgpCount, pbCount, ppCount, ledgerCount] = await Promise.all([
      tx.select({ n: count() }).from(purchaseGatePassesTable)
        .where(eq(purchaseGatePassesTable.purchasePartyId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(purchaseBillsTable)
        .where(eq(purchaseBillsTable.purchasePartyId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(paymentPaidsTable)
        .where(eq(paymentPaidsTable.purchasePartyId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(ledgerEntriesTable)
        .where(eq(ledgerEntriesTable.purchasePartyId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
    ]);

    if (pgpCount + pbCount + ppCount + ledgerCount > 0) {
      throw new PurchasePartyInUseError(id);
    }

    await tx.delete(purchasePartiesTable).where(eq(purchasePartiesTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function getPurchaseParty(id: number): Promise<PurchasePartyRow | null> {
  const rows = await db
    .select()
    .from(purchasePartiesTable)
    .where(eq(purchasePartiesTable.id, id));
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listPurchaseParties(
  input: ListPurchasePartiesInput = {}
): Promise<{ rows: PurchasePartyRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const where = input.search
    ? ilike(purchasePartiesTable.name, `%${input.search}%`)
    : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(purchasePartiesTable).where(where)
      .then((r) => r[0]?.total ?? 0),
    db.select().from(purchasePartiesTable)
      .where(where)
      .orderBy(desc(purchasePartiesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
