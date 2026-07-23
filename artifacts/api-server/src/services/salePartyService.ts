/**
 * Sale Party Service
 *
 * Master-data CRUD for sale_parties (customers).
 * No ledger or stock writes — financial history is managed by the
 * transaction modules (Sale Gate Pass, Sales Bill, Payment Receive,
 * Return Gate Pass, Return Bill).
 *
 * Delete protection: a sale party cannot be deleted while it is
 * referenced by any gate pass, bill, payment, or ledger entry.
 */

import { count, desc, eq, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ledgerEntriesTable,
  paymentReceivesTable,
  returnBillsTable,
  returnGatePassesTable,
  saleGatePassesTable,
  salesBillsTable,
  salePartiesTable,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SalePartyRow = typeof salePartiesTable.$inferSelect;

export interface CreateSalePartyInput {
  name:         string;
  creditLimit?: number | null;
}

export interface UpdateSalePartyInput {
  name?:        string;
  creditLimit?: number | null;
}

export interface ListSalePartiesInput {
  search?: string;
  limit?:  number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SalePartyNotFoundError extends Error {
  constructor(id: number) {
    super(`Sale Party not found: id=${id}`);
    this.name = "SalePartyNotFoundError";
  }
}

export class SalePartyInUseError extends Error {
  constructor(id: number) {
    super(
      `Sale Party id=${id} cannot be deleted because it is referenced ` +
      "by existing gate passes, bills, payments, or ledger entries."
    );
    this.name = "SalePartyInUseError";
  }
}

export class SalePartyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalePartyValidationError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new SalePartyValidationError("name is required and cannot be blank.");
  }
  if (name.trim().length > 255) {
    throw new SalePartyValidationError("name cannot exceed 255 characters.");
  }
}

function validateCreditLimit(creditLimit: number | null | undefined): void {
  if (creditLimit != null && (!isFinite(creditLimit) || creditLimit < 0)) {
    throw new SalePartyValidationError(
      "creditLimit must be a non-negative finite number when provided."
    );
  }
}

function fmtMoney(v: number): string {
  return v.toFixed(2);
}

async function fetchLocked(tx: Tx, id: number): Promise<SalePartyRow> {
  const rows = await tx
    .select()
    .from(salePartiesTable)
    .where(eq(salePartiesTable.id, id))
    .for("update");
  if (rows.length === 0) throw new SalePartyNotFoundError(id);
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createSaleParty(
  input: CreateSalePartyInput
): Promise<SalePartyRow> {
  validateName(input.name);
  validateCreditLimit(input.creditLimit);

  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(salePartiesTable)
      .values({
        name:        input.name.trim(),
        creditLimit: input.creditLimit != null ? fmtMoney(input.creditLimit) : null,
      })
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updateSaleParty(
  id: number,
  input: UpdateSalePartyInput
): Promise<SalePartyRow> {
  if (input.name !== undefined) validateName(input.name);
  validateCreditLimit(input.creditLimit);

  return db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    const rows = await tx
      .update(salePartiesTable)
      .set({
        ...(input.name        !== undefined && { name: input.name.trim() }),
        ...(input.creditLimit !== undefined && {
          creditLimit: input.creditLimit != null ? fmtMoney(input.creditLimit) : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(salePartiesTable.id, id))
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteSaleParty(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    const [sgpCount, sbCount, prCount, rgpCount, rbCount, ledgerCount] =
      await Promise.all([
        tx.select({ n: count() }).from(saleGatePassesTable)
          .where(eq(saleGatePassesTable.salePartyId, id))
          .then((r) => Number(r[0]?.n ?? 0)),
        tx.select({ n: count() }).from(salesBillsTable)
          .where(eq(salesBillsTable.salePartyId, id))
          .then((r) => Number(r[0]?.n ?? 0)),
        tx.select({ n: count() }).from(paymentReceivesTable)
          .where(eq(paymentReceivesTable.salePartyId, id))
          .then((r) => Number(r[0]?.n ?? 0)),
        tx.select({ n: count() }).from(returnGatePassesTable)
          .where(eq(returnGatePassesTable.salePartyId, id))
          .then((r) => Number(r[0]?.n ?? 0)),
        tx.select({ n: count() }).from(returnBillsTable)
          .where(eq(returnBillsTable.salePartyId, id))
          .then((r) => Number(r[0]?.n ?? 0)),
        tx.select({ n: count() }).from(ledgerEntriesTable)
          .where(eq(ledgerEntriesTable.salePartyId, id))
          .then((r) => Number(r[0]?.n ?? 0)),
      ]);

    if (sgpCount + sbCount + prCount + rgpCount + rbCount + ledgerCount > 0) {
      throw new SalePartyInUseError(id);
    }

    await tx.delete(salePartiesTable).where(eq(salePartiesTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function getSaleParty(id: number): Promise<SalePartyRow | null> {
  const rows = await db
    .select()
    .from(salePartiesTable)
    .where(eq(salePartiesTable.id, id));
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listSaleParties(
  input: ListSalePartiesInput = {}
): Promise<{ rows: SalePartyRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const where = input.search
    ? ilike(salePartiesTable.name, `%${input.search}%`)
    : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(salePartiesTable).where(where)
      .then((r) => r[0]?.total ?? 0),
    db.select().from(salePartiesTable)
      .where(where)
      .orderBy(desc(salePartiesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
