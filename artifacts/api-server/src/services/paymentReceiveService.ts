/**
 * Payment Receive Service
 *
 * Owns the full lifecycle of Payment Receive vouchers:
 *   Create → Update → Delete → Get / List
 *
 * Integrations (per approved architecture):
 *   - Number Series Service : generates the PR document number (own transaction,
 *                             called before the main transaction — gaps on failure
 *                             are acceptable and normal in ERP systems).
 *   - Financial Ledger      : CREDIT entries posted inline within the main
 *                             transaction using tx-scoped helpers. Balance
 *                             maintained as a running total keyed on
 *                             sale_party_id.
 *
 * Scope boundaries (hard rules):
 *   - Never touches stock_ledger_entries.
 *   - Never generates any document number other than PR.
 *   - Financial ledger reversals use compensating entries (debit) — original
 *     credit rows are never deleted.
 *
 * Ledger semantics:
 *   Payment Receive = CREDIT: customer paid us, reducing their outstanding receivable.
 *     new_balance = current_balance − amount
 *   Reversal        = DEBIT:  restores the receivable when a receipt is voided.
 *     new_balance = current_balance + amount
 */

import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  paymentReceivesTable,
  salePartiesTable,
  ledgerEntriesTable,
} from "@workspace/db/schema";
import {
  DOCUMENT_TYPES,
  getNextDocumentNumber,
} from "./numberSeriesService";

// ---------------------------------------------------------------------------
// Internal transaction type
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Public error classes
// ---------------------------------------------------------------------------

export class PaymentReceiveNotFoundError extends Error {
  constructor(id: number) {
    super(`Payment Receive not found: id=${id}`);
    this.name = "PaymentReceiveNotFoundError";
  }
}

export class PaymentReceivePartyNotFoundError extends Error {
  constructor(salePartyId: number) {
    super(`Sale Party not found: id=${salePartyId}`);
    this.name = "PaymentReceivePartyNotFoundError";
  }
}

export class PaymentReceiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentReceiveValidationError";
  }
}

// ---------------------------------------------------------------------------
// Public input / output types
// ---------------------------------------------------------------------------

/** Input for creating a new Payment Receive voucher. */
export interface CreatePaymentReceiveInput {
  salePartyId: number;
  /** ISO calendar date — "YYYY-MM-DD". */
  date: string;
  /** 'Cash' or 'Bank'. */
  paymentMode?: string | null;
  /**
   * Amount received from the customer.
   * A financial ledger CREDIT entry is posted only when this is > 0.
   */
  amount?: number | null;
  remarks?: string | null;
}

/**
 * Input for updating an existing Payment Receive voucher.
 * All fields are optional; omitted fields keep their current value.
 */
export interface UpdatePaymentReceiveInput {
  date?: string;
  paymentMode?: string | null;
  amount?: number | null;
  remarks?: string | null;
}

export interface ListPaymentReceivesInput {
  salePartyId?: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export type PaymentReceiveRow = typeof paymentReceivesTable.$inferSelect;

// ---------------------------------------------------------------------------
// Internal numeric helpers
// ---------------------------------------------------------------------------

/** Formats a JS number to 2-decimal string for numeric(12,2) columns. */
function fmtMoney(v: number): string {
  return v.toFixed(2);
}

/** Parses a PostgreSQL numeric string to a JS number. Returns 0 for null/NaN. */
function parseNum(v: string | null | undefined): number {
  if (v == null) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Input validation (pure, runs before any I/O)
// ---------------------------------------------------------------------------

function validateDate(date: string, field: string): void {
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new PaymentReceiveValidationError(
      `${field} must be in YYYY-MM-DD format.`
    );
  }
}

function validateAmount(amount: number | null | undefined): void {
  if (amount != null && (!isFinite(amount) || amount < 0)) {
    throw new PaymentReceiveValidationError(
      "amount must be a non-negative finite number when provided."
    );
  }
}

function validatePaymentMode(mode: string | null | undefined): void {
  if (mode != null && mode !== "Cash" && mode !== "Bank") {
    throw new PaymentReceiveValidationError(
      "paymentMode must be 'Cash' or 'Bank' when provided."
    );
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped: sale party locking
// ---------------------------------------------------------------------------

/**
 * Locks the sale party row exclusively within a transaction.
 * Serialises all concurrent financial ledger writes for the same party.
 * Must be called before any ledger read or write for this party within the tx.
 *
 * @throws PaymentReceivePartyNotFoundError if the party does not exist.
 */
async function lockSaleParty(tx: Tx, salePartyId: number): Promise<void> {
  const rows = await tx
    .select({ id: salePartiesTable.id })
    .from(salePartiesTable)
    .where(eq(salePartiesTable.id, salePartyId))
    .for("update");

  if (rows.length === 0) {
    throw new PaymentReceivePartyNotFoundError(salePartyId);
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped: financial ledger balance
// ---------------------------------------------------------------------------

/**
 * Returns the most recent financial ledger balance for a sale party.
 * Must only be called after lockSaleParty() within the same transaction.
 */
async function getLatestPartyLedgerBalance(
  tx: Tx,
  salePartyId: number
): Promise<number> {
  const rows = await tx
    .select({ balance: ledgerEntriesTable.balance })
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.salePartyId, salePartyId))
    .orderBy(desc(ledgerEntriesTable.id))
    .limit(1);

  return rows.length > 0 ? parseNum(rows[0]!.balance) : 0;
}

// ---------------------------------------------------------------------------
// Transaction-scoped: financial ledger writers
// ---------------------------------------------------------------------------

/**
 * Posts a CREDIT entry to the sale party's financial ledger within tx.
 *
 * Payment Receive semantics: customer paid us — reduces their outstanding receivable.
 *   new_balance = current_balance − amount
 *
 * Only called when amount > 0.
 */
async function insertLedgerCredit(
  tx: Tx,
  params: {
    salePartyId: number;
    date: string;
    description: string;
    refNo: string;
    amount: number;
  }
): Promise<void> {
  const currentBalance = await getLatestPartyLedgerBalance(tx, params.salePartyId);
  const newBalance = currentBalance - params.amount;

  await tx
    .insert(ledgerEntriesTable)
    .values({
      salePartyId:     params.salePartyId,
      purchasePartyId: null,
      date:            params.date,
      description:     params.description,
      refNo:           params.refNo,
      debit:           null,
      credit:          fmtMoney(params.amount),
      balance:         fmtMoney(newBalance),
    });
}

/**
 * Posts a DEBIT entry as a compensating reversal of a prior CREDIT within tx.
 *
 * Used when voiding or updating a Payment Receive:
 *   new_balance = current_balance + amount
 *
 * The original CREDIT row is never modified or deleted — this debit is an
 * additive compensating entry that restores the balance.
 */
async function insertLedgerDebit(
  tx: Tx,
  params: {
    salePartyId: number;
    date: string;
    description: string;
    refNo: string;
    amount: number;
  }
): Promise<void> {
  const currentBalance = await getLatestPartyLedgerBalance(tx, params.salePartyId);
  const newBalance = currentBalance + params.amount;

  await tx
    .insert(ledgerEntriesTable)
    .values({
      salePartyId:     params.salePartyId,
      purchasePartyId: null,
      date:            params.date,
      description:     params.description,
      refNo:           params.refNo,
      debit:           fmtMoney(params.amount),
      credit:          null,
      balance:         fmtMoney(newBalance),
    });
}

// ---------------------------------------------------------------------------
// Transaction-scoped: fetch and lock a payment receive row
// ---------------------------------------------------------------------------

/**
 * Fetches a Payment Receive row with a FOR UPDATE lock.
 * @throws PaymentReceiveNotFoundError if the record does not exist.
 */
async function fetchLockedPaymentReceive(
  tx: Tx,
  id: number
): Promise<PaymentReceiveRow> {
  const rows = await tx
    .select()
    .from(paymentReceivesTable)
    .where(eq(paymentReceivesTable.id, id))
    .for("update");

  if (rows.length === 0) {
    throw new PaymentReceiveNotFoundError(id);
  }
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Payment Receive voucher.
 *
 * Transaction sequence (after number generation):
 *   1. Lock sale party row (ledger anchor + existence check).
 *   2. INSERT payment_receives header.
 *   3. If amount > 0: INSERT ledger CREDIT entry.
 *
 * @throws PaymentReceiveValidationError
 * @throws PaymentReceivePartyNotFoundError
 */
export async function createPaymentReceive(
  input: CreatePaymentReceiveInput
): Promise<PaymentReceiveRow> {
  // Pre-flight validation (no I/O)
  validateDate(input.date, "date");
  validateAmount(input.amount);
  validatePaymentMode(input.paymentMode);

  // Generate PR number before the main transaction (own committed transaction).
  const prNumber = await getNextDocumentNumber(DOCUMENT_TYPES.PaymentReceive);

  return db.transaction(async (tx) => {
    // Step 1 — lock party row (establishes ledger serialisation anchor).
    await lockSaleParty(tx, input.salePartyId);

    // Step 2 — insert header.
    const inserted = await tx
      .insert(paymentReceivesTable)
      .values({
        prNumber,
        date:        input.date,
        salePartyId: input.salePartyId,
        paymentMode: input.paymentMode ?? null,
        amount:      input.amount != null ? fmtMoney(input.amount) : null,
        remarks:     input.remarks ?? null,
      })
      .returning();

    const record = inserted[0]!;

    // Step 3 — post CREDIT if amount was provided.
    if (input.amount != null && input.amount > 0) {
      await insertLedgerCredit(tx, {
        salePartyId: input.salePartyId,
        date:        input.date,
        description: `Payment Receive - ${prNumber}`,
        refNo:       prNumber,
        amount:      input.amount,
      });
    }

    return record;
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Updates an existing Payment Receive voucher.
 *
 * Full reversal-and-repost strategy for the ledger:
 *   1. Lock voucher FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse existing CREDIT (if any) via a compensating DEBIT.
 *   4. Update header.
 *   5. Post fresh CREDIT if effective amount > 0.
 *
 * @throws PaymentReceiveNotFoundError
 * @throws PaymentReceiveValidationError
 * @throws PaymentReceivePartyNotFoundError
 */
export async function updatePaymentReceive(
  id: number,
  input: UpdatePaymentReceiveInput
): Promise<PaymentReceiveRow> {
  if (input.date !== undefined) {
    validateDate(input.date, "date");
  }
  validateAmount(input.amount);
  validatePaymentMode(input.paymentMode);

  return db.transaction(async (tx) => {
    // Step 1 — lock voucher.
    const record = await fetchLockedPaymentReceive(tx, id);

    // Step 2 — lock party row.
    await lockSaleParty(tx, record.salePartyId);

    // Step 3 — reverse existing CREDIT if one was previously posted.
    const oldAmount = parseNum(record.amount);
    if (oldAmount > 0) {
      await insertLedgerDebit(tx, {
        salePartyId: record.salePartyId,
        date:        record.date,
        description: `Reversal - ${record.prNumber}`,
        refNo:       record.prNumber,
        amount:      oldAmount,
      });
    }

    // Step 4 — update header (keep current values for unset fields).
    const effectiveAmount = input.amount !== undefined ? input.amount : oldAmount;
    const effectiveDate   = input.date ?? record.date;

    const updated = await tx
      .update(paymentReceivesTable)
      .set({
        date:        effectiveDate,
        paymentMode: input.paymentMode !== undefined ? input.paymentMode : record.paymentMode,
        amount:      input.amount !== undefined
          ? (input.amount != null ? fmtMoney(input.amount) : null)
          : record.amount,
        remarks:     input.remarks !== undefined ? input.remarks : record.remarks,
        updatedAt:   new Date(),
      })
      .where(eq(paymentReceivesTable.id, id))
      .returning();

    // Step 5 — post fresh CREDIT if effective amount > 0.
    if (effectiveAmount != null && effectiveAmount > 0) {
      await insertLedgerCredit(tx, {
        salePartyId: record.salePartyId,
        date:        effectiveDate,
        description: `Payment Receive - ${record.prNumber}`,
        refNo:       record.prNumber,
        amount:      effectiveAmount,
      });
    }

    return updated[0]!;
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Deletes a Payment Receive voucher and reverses its financial effect.
 *
 * Transaction sequence:
 *   1. Lock voucher FOR UPDATE.
 *   2. Lock party row.
 *   3. Post compensating DEBIT if a CREDIT was previously posted.
 *   4. Delete voucher row.
 *
 * Original CREDIT ledger rows are NEVER deleted.
 *
 * @throws PaymentReceiveNotFoundError
 */
export async function deletePaymentReceive(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Step 1 — lock voucher.
    const record = await fetchLockedPaymentReceive(tx, id);

    // Step 2 — lock party row.
    await lockSaleParty(tx, record.salePartyId);

    // Step 3 — reverse the CREDIT if one was posted (compensating DEBIT).
    const oldAmount = parseNum(record.amount);
    if (oldAmount > 0) {
      await insertLedgerDebit(tx, {
        salePartyId: record.salePartyId,
        date:        record.date,
        description: `Reversal (Deleted) - ${record.prNumber}`,
        refNo:       record.prNumber,
        amount:      oldAmount,
      });
    }

    // Step 4 — delete voucher.
    await tx
      .delete(paymentReceivesTable)
      .where(eq(paymentReceivesTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

/**
 * Returns a Payment Receive voucher by its database id.
 * Returns null if not found (no error thrown).
 */
export async function getPaymentReceive(
  id: number
): Promise<PaymentReceiveRow | null> {
  const rows = await db
    .select()
    .from(paymentReceivesTable)
    .where(eq(paymentReceivesTable.id, id));

  return rows.length > 0 ? rows[0]! : null;
}

/**
 * Returns a Payment Receive voucher by its document number (e.g. "PR0001").
 * Returns null if not found.
 */
export async function getPaymentReceiveByNumber(
  prNumber: string
): Promise<PaymentReceiveRow | null> {
  const rows = await db
    .select()
    .from(paymentReceivesTable)
    .where(eq(paymentReceivesTable.prNumber, prNumber));

  return rows.length > 0 ? rows[0]! : null;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of Payment Receive vouchers.
 *
 * Ordered newest first (descending by date, then by id).
 */
export async function listPaymentReceives(
  input: ListPaymentReceivesInput = {}
): Promise<{ rows: PaymentReceiveRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.salePartyId !== undefined) {
    conditions.push(eq(paymentReceivesTable.salePartyId, input.salePartyId));
  }
  if (input.fromDate !== undefined) {
    conditions.push(gte(paymentReceivesTable.date, input.fromDate));
  }
  if (input.toDate !== undefined) {
    conditions.push(lte(paymentReceivesTable.date, input.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(paymentReceivesTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),
    db
      .select()
      .from(paymentReceivesTable)
      .where(where)
      .orderBy(desc(paymentReceivesTable.date), desc(paymentReceivesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
