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

import { count, desc, eq, ilike, or } from "drizzle-orm";
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
  name:          string;
  nameUrdu?:     string | null;
  address?:      string | null;
  city?:         string | null;
  phone?:        string | null;
  mobile?:       string | null;
  creditLimit?:  number | null;
  openingCredit?: number | null;
  openingDebit?:  number | null;
  type?:         string | null;
  shikanjaId?:   number | null;
}

export type UpdateSalePartyInput = Partial<CreateSalePartyInput>;

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

function fmtMoney(v: number): string {
  return v.toFixed(2);
}

function buildValues(input: CreateSalePartyInput) {
  return {
    name:          input.name.trim(),
    nameUrdu:      input.nameUrdu    ?? null,
    address:       input.address     ?? null,
    city:          input.city        ?? null,
    phone:         input.phone       ?? null,
    mobile:        input.mobile      ?? null,
    creditLimit:   input.creditLimit   != null ? fmtMoney(input.creditLimit)   : null,
    openingCredit: input.openingCredit != null ? fmtMoney(input.openingCredit) : null,
    openingDebit:  input.openingDebit  != null ? fmtMoney(input.openingDebit)  : null,
    type:          input.type        ?? null,
    shikanjaId:    input.shikanjaId  ?? null,
  };
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

  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(salePartiesTable)
      .values(buildValues(input))
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

  return db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name          !== undefined) set["name"]          = input.name!.trim();
    if (input.nameUrdu      !== undefined) set["nameUrdu"]      = input.nameUrdu     ?? null;
    if (input.address       !== undefined) set["address"]       = input.address      ?? null;
    if (input.city          !== undefined) set["city"]          = input.city         ?? null;
    if (input.phone         !== undefined) set["phone"]         = input.phone        ?? null;
    if (input.mobile        !== undefined) set["mobile"]        = input.mobile       ?? null;
    if (input.creditLimit   !== undefined) set["creditLimit"]   = input.creditLimit   != null ? fmtMoney(input.creditLimit)   : null;
    if (input.openingCredit !== undefined) set["openingCredit"] = input.openingCredit != null ? fmtMoney(input.openingCredit) : null;
    if (input.openingDebit  !== undefined) set["openingDebit"]  = input.openingDebit  != null ? fmtMoney(input.openingDebit)  : null;
    if (input.type          !== undefined) set["type"]          = input.type         ?? null;
    if (input.shikanjaId    !== undefined) set["shikanjaId"]    = input.shikanjaId   ?? null;

    const rows = await tx
      .update(salePartiesTable)
      .set(set as any)
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
    ? or(
        ilike(salePartiesTable.name, `%${input.search}%`),
        ilike(salePartiesTable.city, `%${input.search}%`),
      )
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
