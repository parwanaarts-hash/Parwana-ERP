/**
 * Report Service — Read-Only Register APIs
 *
 * Five registers, all read-only:
 *   purchaseRegister     — purchase_bills   JOIN purchase_parties
 *   salesRegister        — sales_bills      JOIN sale_parties
 *   returnRegister       — return_bills     JOIN sale_parties
 *   paymentReceiveRegister — payment_receives JOIN sale_parties
 *   paymentPaidRegister  — payment_paids    JOIN purchase_parties
 *
 * No ledger, stock, or document writes of any kind.
 * COUNT and SELECT run in parallel for every list endpoint.
 * Existing FK indexes (idx_pb_party/idx_pb_date etc.) are used by all queries.
 */

import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  paymentPaidsTable,
  paymentReceivesTable,
  purchaseBillsTable,
  purchasePartiesTable,
  returnBillsTable,
  salesBillsTable,
  salePartiesTable,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** A single row in any register report. */
export interface RegisterRow {
  id:          number;
  docNumber:   string;
  date:        string;
  partyId:     number;
  partyName:   string;
  amount:      string | null;
  remarks:     string | null;
}

/** Paginated register result. */
export interface RegisterResult {
  rows:  RegisterRow[];
  total: number;
}

/** Common filter shape for all registers. */
export interface RegisterFilters {
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?:   string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?:     string;
  /** Filter to one party. */
  partyId?:    number;
  /** Substring match on document number (case-insensitive). */
  docNumber?:  string;
  limit?:      number;
  offset?:     number;
}

// ---------------------------------------------------------------------------
// Helper — safe condition list builder
// ---------------------------------------------------------------------------

type Condition = ReturnType<typeof eq>;

function applyDatePartyFilters(
  dateCol:  Parameters<typeof gte>[0],
  partyCol: Parameters<typeof eq>[0],
  f:        RegisterFilters
): Condition[] {
  const conds: Condition[] = [];
  if (f.fromDate  !== undefined) conds.push(gte(dateCol,  f.fromDate));
  if (f.toDate    !== undefined) conds.push(lte(dateCol,  f.toDate));
  if (f.partyId   !== undefined) conds.push(eq(partyCol,  f.partyId));
  return conds;
}

// ---------------------------------------------------------------------------
// 1. Purchase Register
// ---------------------------------------------------------------------------

/**
 * Returns paginated Purchase Bills joined with Purchase Party name.
 * Sorted newest-first (billDate DESC, id DESC).
 * Supports: fromDate, toDate, partyId (purchasePartyId), docNumber (billNumber).
 */
export async function purchaseRegister(
  f: RegisterFilters = {}
): Promise<RegisterResult> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = applyDatePartyFilters(
    purchaseBillsTable.billDate,
    purchaseBillsTable.purchasePartyId,
    f
  );
  if (f.docNumber !== undefined) {
    conds.push(ilike(purchaseBillsTable.billNumber, `%${f.docNumber}%`));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(purchaseBillsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:        purchaseBillsTable.id,
        docNumber: purchaseBillsTable.billNumber,
        date:      purchaseBillsTable.billDate,
        partyId:   purchaseBillsTable.purchasePartyId,
        partyName: purchasePartiesTable.name,
        amount:    purchaseBillsTable.billAmount,
        remarks:   purchaseBillsTable.remarks,
      })
      .from(purchaseBillsTable)
      .innerJoin(
        purchasePartiesTable,
        eq(purchaseBillsTable.purchasePartyId, purchasePartiesTable.id)
      )
      .where(where)
      .orderBy(desc(purchaseBillsTable.billDate), desc(purchaseBillsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}

// ---------------------------------------------------------------------------
// 2. Sales Register
// ---------------------------------------------------------------------------

/**
 * Returns paginated Sales Bills joined with Sale Party name.
 * Sorted newest-first (billDate DESC, id DESC).
 * Supports: fromDate, toDate, partyId (salePartyId), docNumber (billNumber).
 */
export async function salesRegister(
  f: RegisterFilters = {}
): Promise<RegisterResult> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = applyDatePartyFilters(
    salesBillsTable.billDate,
    salesBillsTable.salePartyId,
    f
  );
  if (f.docNumber !== undefined) {
    conds.push(ilike(salesBillsTable.billNumber, `%${f.docNumber}%`));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(salesBillsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:        salesBillsTable.id,
        docNumber: salesBillsTable.billNumber,
        date:      salesBillsTable.billDate,
        partyId:   salesBillsTable.salePartyId,
        partyName: salePartiesTable.name,
        amount:    salesBillsTable.billAmount,
        remarks:   salesBillsTable.remarks,
      })
      .from(salesBillsTable)
      .innerJoin(
        salePartiesTable,
        eq(salesBillsTable.salePartyId, salePartiesTable.id)
      )
      .where(where)
      .orderBy(desc(salesBillsTable.billDate), desc(salesBillsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}

// ---------------------------------------------------------------------------
// 3. Return Register
// ---------------------------------------------------------------------------

/**
 * Returns paginated Return Bills joined with Sale Party name.
 * Sorted newest-first (billDate DESC, id DESC).
 * Supports: fromDate, toDate, partyId (salePartyId), docNumber (billNumber).
 */
export async function returnRegister(
  f: RegisterFilters = {}
): Promise<RegisterResult> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = applyDatePartyFilters(
    returnBillsTable.billDate,
    returnBillsTable.salePartyId,
    f
  );
  if (f.docNumber !== undefined) {
    conds.push(ilike(returnBillsTable.billNumber, `%${f.docNumber}%`));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(returnBillsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:        returnBillsTable.id,
        docNumber: returnBillsTable.billNumber,
        date:      returnBillsTable.billDate,
        partyId:   returnBillsTable.salePartyId,
        partyName: salePartiesTable.name,
        amount:    returnBillsTable.billAmount,
        remarks:   returnBillsTable.remarks,
      })
      .from(returnBillsTable)
      .innerJoin(
        salePartiesTable,
        eq(returnBillsTable.salePartyId, salePartiesTable.id)
      )
      .where(where)
      .orderBy(desc(returnBillsTable.billDate), desc(returnBillsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}

// ---------------------------------------------------------------------------
// 4. Payment Receive Register
// ---------------------------------------------------------------------------

/**
 * Returns paginated Payment Receives joined with Sale Party name.
 * Sorted newest-first (date DESC, id DESC).
 * Supports: fromDate, toDate, partyId (salePartyId), docNumber (prNumber).
 */
export async function paymentReceiveRegister(
  f: RegisterFilters = {}
): Promise<RegisterResult> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = applyDatePartyFilters(
    paymentReceivesTable.date,
    paymentReceivesTable.salePartyId,
    f
  );
  if (f.docNumber !== undefined) {
    conds.push(ilike(paymentReceivesTable.prNumber, `%${f.docNumber}%`));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(paymentReceivesTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:        paymentReceivesTable.id,
        docNumber: paymentReceivesTable.prNumber,
        date:      paymentReceivesTable.date,
        partyId:   paymentReceivesTable.salePartyId,
        partyName: salePartiesTable.name,
        amount:    paymentReceivesTable.amount,
        remarks:   paymentReceivesTable.remarks,
      })
      .from(paymentReceivesTable)
      .innerJoin(
        salePartiesTable,
        eq(paymentReceivesTable.salePartyId, salePartiesTable.id)
      )
      .where(where)
      .orderBy(desc(paymentReceivesTable.date), desc(paymentReceivesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}

// ---------------------------------------------------------------------------
// 5. Payment Paid Register
// ---------------------------------------------------------------------------

/**
 * Returns paginated Payment Paids joined with Purchase Party name.
 * Sorted newest-first (date DESC, id DESC).
 * Supports: fromDate, toDate, partyId (purchasePartyId), docNumber (ppNumber).
 */
export async function paymentPaidRegister(
  f: RegisterFilters = {}
): Promise<RegisterResult> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = applyDatePartyFilters(
    paymentPaidsTable.date,
    paymentPaidsTable.purchasePartyId,
    f
  );
  if (f.docNumber !== undefined) {
    conds.push(ilike(paymentPaidsTable.ppNumber, `%${f.docNumber}%`));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(paymentPaidsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:        paymentPaidsTable.id,
        docNumber: paymentPaidsTable.ppNumber,
        date:      paymentPaidsTable.date,
        partyId:   paymentPaidsTable.purchasePartyId,
        partyName: purchasePartiesTable.name,
        amount:    paymentPaidsTable.amount,
        remarks:   paymentPaidsTable.remarks,
      })
      .from(paymentPaidsTable)
      .innerJoin(
        purchasePartiesTable,
        eq(paymentPaidsTable.purchasePartyId, purchasePartiesTable.id)
      )
      .where(where)
      .orderBy(desc(paymentPaidsTable.date), desc(paymentPaidsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
