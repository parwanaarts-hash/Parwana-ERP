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
  name:          string;
  nameUrdu?:     string | null;
  address?:      string | null;
  city?:         string | null;
  phone?:        string | null;
  mobile?:       string | null;
  openingCredit?: number | null;
  openingDebit?:  number | null;
  type?:         string | null;
  shikanjaId?:   number | null;
}

export type UpdatePurchasePartyInput = Partial<CreatePurchasePartyInput>;

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

function fmtMoney(v: number): string {
  return v.toFixed(2);
}

function buildValues(input: CreatePurchasePartyInput) {
  return {
    name:          input.name.trim(),
    nameUrdu:      input.nameUrdu    ?? null,
    address:       input.address     ?? null,
    city:          input.city        ?? null,
    phone:         input.phone       ?? null,
    mobile:        input.mobile      ?? null,
    openingCredit: input.openingCredit != null ? fmtMoney(input.openingCredit) : null,
    openingDebit:  input.openingDebit  != null ? fmtMoney(input.openingDebit)  : null,
    type:          input.type        ?? null,
    shikanjaId:    input.shikanjaId  ?? null,
  };
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
      .values(buildValues(input))
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

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name          !== undefined) set["name"]          = input.name!.trim();
    if (input.nameUrdu      !== undefined) set["nameUrdu"]      = input.nameUrdu ?? null;
    if (input.address       !== undefined) set["address"]       = input.address  ?? null;
    if (input.city          !== undefined) set["city"]          = input.city     ?? null;
    if (input.phone         !== undefined) set["phone"]         = input.phone    ?? null;
    if (input.mobile        !== undefined) set["mobile"]        = input.mobile   ?? null;
    if (input.openingCredit !== undefined) set["openingCredit"] = input.openingCredit != null ? fmtMoney(input.openingCredit) : null;
    if (input.openingDebit  !== undefined) set["openingDebit"]  = input.openingDebit  != null ? fmtMoney(input.openingDebit)  : null;
    if (input.type          !== undefined) set["type"]          = input.type     ?? null;
    if (input.shikanjaId    !== undefined) set["shikanjaId"]    = input.shikanjaId ?? null;

    const rows = await tx
      .update(purchasePartiesTable)
      .set(set as any)
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
    ? or(
        ilike(purchasePartiesTable.name, `%${input.search}%`),
        ilike(purchasePartiesTable.city, `%${input.search}%`),
      )
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
