/**
 * Payment Paid Service
 *
 * Owns the full lifecycle of Payment Paid vouchers:
 *   Create → Update → Delete → Get / List
 *
 * Integrations (per approved architecture):
 *   - Number Series Service : generates the PP document number (own transaction,
 *                             called before the main transaction — gaps on failure
 *                             are acceptable and normal in ERP systems).
 *   - Financial Ledger      : CREDIT entries posted inline within the main
 *                             transaction using tx-scoped helpers. Balance
 *                             maintained as a running total keyed on
 *                             purchase_party_id.
 *
 * Scope boundaries (hard rules):
 *   - Never touches stock_ledger_entries.
 *   - Never generates any document number other than PP.
 *   - Financial ledger reversals use compensating entries (debit) — original
 *     credit rows are never deleted.
 *
 * Ledger semantics:
 *   Payment Paid = CREDIT: reduces the outstanding payable to the supplier.
 *     new_balance = current_balance − amount
 *   Reversal     = DEBIT:  restores the payable when a payment is voided.
 *     new_balance = current_balance + amount
 */

import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  paymentPaidsTable,
  purchasePartiesTable,
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

export class PaymentPaidNotFoundError extends Error {
  constructor(id: number) {
    super(`Payment Paid not found: id=${id}`);
    this.name = "PaymentPaidNotFoundError";
  }
}

export class PaymentPaidPartyNotFoundError extends Error {
  constructor(purchasePartyId: number) {
    super(`Purchase Party not found: id=${purchasePartyId}`);
    this.name = "PaymentPaidPartyNotFoundError";
  }
}

export class PaymentPaidValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentPaidValidationError";
  }
}

// ---------------------------------------------------------------------------
// Public input / output types
// ---------------------------------------------------------------------------

/** Input for creating a new Payment Paid voucher. */
export interface CreatePaymentPaidInput {
  purchasePartyId: number;
  /** ISO calendar date — "YYYY-MM-DD". */
  date: string;
  /** 'Cash' or 'Bank'. */
  paymentMode?: string | null;
  /**
   * Amount paid to the supplier.
   * A financial ledger CREDIT entry is posted only when this is > 0.
   */
  amount?: number | null;
  remarks?: string | null;
}

/**
 * Input for updating an existing Payment Paid voucher.
 * All fields are optional; omitted fields keep their current value.
 */
export interface UpdatePaymentPaidInput {
  date?: string;
  paymentMode?: string | null;
  amount?: number | null;
  remarks?: string | null;
}

export interface ListPaymentPaidsInput {
  purchasePartyId?: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export type PaymentPaidRow = typeof paymentPaidsTable.$inferSelect;

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
    throw new PaymentPaidValidationError(
      `${field} must be in YYYY-MM-DD format.`
    );
  }
}

function validateAmount(amount: number | null | undefined): void {
  if (amount != null && (!isFinite(amount) || amount < 0)) {
    throw new PaymentPaidValidationError(
      "amount must be a non-negative finite number when provided."
    );
  }
}

function validatePaymentMode(mode: string | null | undefined): void {
  if (mode != null && mode !== "Cash" && mode !== "Bank") {
    throw new PaymentPaidValidationError(
      "paymentMode must be 'Cash' or 'Bank' when provided."
    );
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped: purchase party locking
// ---------------------------------------------------------------------------

/**
 * Locks the purchase party row exclusively within a transaction.
 * Serialises all concurrent financial ledger writes for the same party.
 * Must be called before any ledger read or write for this party within the tx.
 *
 * @throws PaymentPaidPartyNotFoundError if the party does not exist.
 */
async function lockPurchaseParty(tx: Tx, purchasePartyId: number): Promise<void> {
  const rows = await tx
    .select({ id: purchasePartiesTable.id })
    .from(purchasePartiesTable)
    .where(eq(purchasePartiesTable.id, purchasePartyId))
    .for("update");

  if (rows.length === 0) {
    throw new PaymentPaidPartyNotFoundError(purchasePartyId);
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped: financial ledger balance
// ---------------------------------------------------------------------------

/**
 * Returns the most recent financial ledger balance for a purchase party.
 * Must only be called after lockPurchaseParty() within the same transaction.
 */
async function getLatestPartyLedgerBalance(
  tx: Tx,
  purchasePartyId: number
): Promise<number> {
  const rows = await tx
    .select({ balance: ledgerEntriesTable.balance })
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.purchasePartyId, purchasePartyId))
    .orderBy(desc(ledgerEntriesTable.id))
    .limit(1);

  return rows.length > 0 ? parseNum(rows[0]!.balance) : 0;
}

// ---------------------------------------------------------------------------
// Transaction-scoped: financial ledger writers
// ---------------------------------------------------------------------------

/**
 * Posts a CREDIT entry to the purchase party's financial ledger within tx.
 *
 * Payment Paid semantics: paying the supplier reduces our outstanding payable.
 *   new_balance = current_balance − amount
 *
 * Only called when amount > 0.
 */
async function insertLedgerCredit(
  tx: Tx,
  params: {
    purchasePartyId: number;
    date: string;
    description: string;
    refNo: string;
    amount: number;
  }
): Promise<void> {
  const currentBalance = await getLatestPartyLedgerBalance(tx, params.purchasePartyId);
  const newBalance = currentBalance - params.amount;

  await tx
    .insert(ledgerEntriesTable)
    .values({
      purchasePartyId: params.purchasePartyId,
      salePartyId:     null,
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
 * Used when voiding or updating a Payment Paid:
 *   new_balance = current_balance + amount
 *
 * The original CREDIT row is never modified or deleted — this debit is an
 * additive compensating entry that restores the balance.
 */
async function insertLedgerDebit(
  tx: Tx,
  params: {
    purchasePartyId: number;
    date: string;
    description: string;
    refNo: string;
    amount: number;
  }
): Promise<void> {
  const currentBalance = await getLatestPartyLedgerBalance(tx, params.purchasePartyId);
  const newBalance = currentBalance + params.amount;

  await tx
    .insert(ledgerEntriesTable)
    .values({
      purchasePartyId: params.purchasePartyId,
      salePartyId:     null,
      date:            params.date,
      description:     params.description,
      refNo:           params.refNo,
      debit:           fmtMoney(params.amount),
      credit:          null,
      balance:         fmtMoney(newBalance),
    });
}

// ---------------------------------------------------------------------------
// Transaction-scoped: fetch and lock a payment paid row
// ---------------------------------------------------------------------------

/**
 * Fetches a Payment Paid row with a FOR UPDATE lock.
 * @throws PaymentPaidNotFoundError if the record does not exist.
 */
async function fetchLockedPaymentPaid(tx: Tx, id: number): Promise<PaymentPaidRow> {
  const rows = await tx
    .select()
    .from(paymentPaidsTable)
    .where(eq(paymentPaidsTable.id, id))
    .for("update");

  if (rows.length === 0) {
    throw new PaymentPaidNotFoundError(id);
  }
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Payment Paid voucher.
 *
 * Transaction sequence (after number generation):
 *   1. Lock purchase party row (ledger anchor + existence check).
 *   2. INSERT payment_paids header.
 *   3. If amount > 0: INSERT ledger CREDIT entry.
 *
 * @throws PaymentPaidValidationError
 * @throws PaymentPaidPartyNotFoundError
 */
export async function createPaymentPaid(
  input: CreatePaymentPaidInput
): Promise<PaymentPaidRow> {
  // Pre-flight validation (no I/O)
  validateDate(input.date, "date");
  validateAmount(input.amount);
  validatePaymentMode(input.paymentMode);

  // Generate PP number before the main transaction (own committed transaction).
  const ppNumber = await getNextDocumentNumber(DOCUMENT_TYPES.PaymentPaid);

  return db.transaction(async (tx) => {
    // Step 1 — lock party row (establishes ledger serialisation anchor).
    await lockPurchaseParty(tx, input.purchasePartyId);

    // Step 2 — insert header.
    const inserted = await tx
      .insert(paymentPaidsTable)
      .values({
        ppNumber,
        date:            input.date,
        purchasePartyId: input.purchasePartyId,
        paymentMode:     input.paymentMode ?? null,
        amount:          input.amount != null ? fmtMoney(input.amount) : null,
        remarks:         input.remarks ?? null,
      })
      .returning();

    const record = inserted[0]!;

    // Step 3 — post CREDIT if amount was provided.
    if (input.amount != null && input.amount > 0) {
      await insertLedgerCredit(tx, {
        purchasePartyId: input.purchasePartyId,
        date:            input.date,
        description:     `Payment Paid - ${ppNumber}`,
        refNo:           ppNumber,
        amount:          input.amount,
      });
    }

    return record;
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Updates an existing Payment Paid voucher.
 *
 * Full reversal-and-repost strategy for the ledger:
 *   1. Lock voucher FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse existing CREDIT (if any) via a compensating DEBIT.
 *   4. Update header.
 *   5. Post fresh CREDIT if effective amount > 0.
 *
 * @throws PaymentPaidNotFoundError
 * @throws PaymentPaidValidationError
 * @throws PaymentPaidPartyNotFoundError
 */
export async function updatePaymentPaid(
  id: number,
  input: UpdatePaymentPaidInput
): Promise<PaymentPaidRow> {
  if (input.date !== undefined) {
    validateDate(input.date, "date");
  }
  validateAmount(input.amount);
  validatePaymentMode(input.paymentMode);

  return db.transaction(async (tx) => {
    // Step 1 — lock voucher.
    const record = await fetchLockedPaymentPaid(tx, id);

    // Step 2 — lock party row.
    await lockPurchaseParty(tx, record.purchasePartyId);

    // Step 3 — reverse existing CREDIT if one was previously posted.
    const oldAmount = parseNum(record.amount);
    if (oldAmount > 0) {
      await insertLedgerDebit(tx, {
        purchasePartyId: record.purchasePartyId,
        date:            record.date,
        description:     `Reversal - ${record.ppNumber}`,
        refNo:           record.ppNumber,
        amount:          oldAmount,
      });
    }

    // Step 4 — update header (keep current values for unset fields).
    const effectiveAmount = input.amount !== undefined ? input.amount : oldAmount;
    const effectiveDate   = input.date ?? record.date;

    const updated = await tx
      .update(paymentPaidsTable)
      .set({
        date:        effectiveDate,
        paymentMode: input.paymentMode !== undefined ? input.paymentMode : record.paymentMode,
        amount:      input.amount !== undefined
          ? (input.amount != null ? fmtMoney(input.amount) : null)
          : record.amount,
        remarks:     input.remarks !== undefined ? input.remarks : record.remarks,
        updatedAt:   new Date(),
      })
      .where(eq(paymentPaidsTable.id, id))
      .returning();

    // Step 5 — post fresh CREDIT if effective amount > 0.
    if (effectiveAmount != null && effectiveAmount > 0) {
      await insertLedgerCredit(tx, {
        purchasePartyId: record.purchasePartyId,
        date:            effectiveDate,
        description:     `Payment Paid - ${record.ppNumber}`,
        refNo:           record.ppNumber,
        amount:          effectiveAmount,
      });
    }

    return updated[0]!;
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Deletes a Payment Paid voucher and reverses its financial effect.
 *
 * Transaction sequence:
 *   1. Lock voucher FOR UPDATE.
 *   2. Lock party row.
 *   3. Post compensating DEBIT if a CREDIT was previously posted.
 *   4. Delete voucher row.
 *
 * Original CREDIT ledger rows are NEVER deleted.
 *
 * @throws PaymentPaidNotFoundError
 */
export async function deletePaymentPaid(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Step 1 — lock voucher.
    const record = await fetchLockedPaymentPaid(tx, id);

    // Step 2 — lock party row.
    await lockPurchaseParty(tx, record.purchasePartyId);

    // Step 3 — reverse the CREDIT if one was posted (compensating DEBIT).
    const oldAmount = parseNum(record.amount);
    if (oldAmount > 0) {
      await insertLedgerDebit(tx, {
        purchasePartyId: record.purchasePartyId,
        date:            record.date,
        description:     `Reversal (Deleted) - ${record.ppNumber}`,
        refNo:           record.ppNumber,
        amount:          oldAmount,
      });
    }

    // Step 4 — delete voucher.
    await tx
      .delete(paymentPaidsTable)
      .where(eq(paymentPaidsTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

/**
 * Returns a Payment Paid voucher by its database id.
 * Returns null if not found (no error thrown).
 */
export async function getPaymentPaid(
  id: number
): Promise<PaymentPaidRow | null> {
  const rows = await db
    .select()
    .from(paymentPaidsTable)
    .where(eq(paymentPaidsTable.id, id));

  return rows.length > 0 ? rows[0]! : null;
}

/**
 * Returns a Payment Paid voucher by its document number (e.g. "PP0001").
 * Returns null if not found.
 */
export async function getPaymentPaidByNumber(
  ppNumber: string
): Promise<PaymentPaidRow | null> {
  const rows = await db
    .select()
    .from(paymentPaidsTable)
    .where(eq(paymentPaidsTable.ppNumber, ppNumber));

  return rows.length > 0 ? rows[0]! : null;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of Payment Paid vouchers.
 *
 * Ordered newest first (descending by date, then by id).
 */
export async function listPaymentPaids(
  input: ListPaymentPaidsInput = {}
): Promise<{ rows: PaymentPaidRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.purchasePartyId !== undefined) {
    conditions.push(eq(paymentPaidsTable.purchasePartyId, input.purchasePartyId));
  }
  if (input.fromDate !== undefined) {
    conditions.push(gte(paymentPaidsTable.date, input.fromDate));
  }
  if (input.toDate !== undefined) {
    conditions.push(lte(paymentPaidsTable.date, input.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(paymentPaidsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),
    db
      .select()
      .from(paymentPaidsTable)
      .where(where)
      .orderBy(desc(paymentPaidsTable.date), desc(paymentPaidsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
