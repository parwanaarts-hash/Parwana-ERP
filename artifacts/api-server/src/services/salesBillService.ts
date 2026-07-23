/**
 * Sales Bill Service
 *
 * Owns the full lifecycle of Sales Bills:
 *   Create → Update → Delete → Get / List
 *
 * Integrations (per approved architecture):
 *   - Number Series Service : generates the SB document number (own transaction,
 *                             called before the main transaction — gaps on failure
 *                             are acceptable and normal in ERP systems).
 *   - Financial Ledger      : DEBIT entries posted inline within the main transaction
 *                             using tx-scoped helpers.  Balance maintained as a running
 *                             total keyed on sale_party_id.
 *   - Gate Passes           : sale_gate_passes.sales_bill_id is updated within
 *                             the same transaction as the bill header.
 *
 * Scope boundaries (hard rules):
 *   - Never touches stock_ledger_entries.  Stock was already posted during
 *     Sale Gate Pass (via qty).  Sales Bill is financial only.
 *   - Never generates any document number other than SB.
 *   - All gate passes on one bill must belong to the same sale party.
 *   - Only unlinked gate passes (salesBillId IS NULL) may be selected.
 *   - Financial ledger reversals use compensating entries (credit) — original
 *     debit rows are never deleted.
 *   - Gate pass links are always fully restored (NULL) before a bill is deleted
 *     or its gate pass selection changes.
 *
 * Ledger semantics for Sales Bills:
 *   Debit  = amount customer owes us (receivable increases).
 *   Credit = compensating entry to reverse a debit (receivable decreases).
 *   new_balance (debit)  = current_balance + amount
 *   new_balance (credit) = current_balance − amount
 */

import { eq, desc, and, gte, lte, asc, isNull, inArray, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesBillsTable,
  salesBillItemsTable,
  saleGatePassesTable,
  saleGatePassItemsTable,
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
// Public input / output types
// ---------------------------------------------------------------------------

/** Input for creating a new Sales Bill. */
export interface CreateSalesBillInput {
  salePartyId: number;
  /** ISO calendar date — "YYYY-MM-DD". */
  billDate: string;
  /**
   * One or more unlinked Sale Gate Pass IDs to include in this bill.
   * All must belong to the same salePartyId.
   * At least one is required.
   */
  gatePassIds: [number, ...number[]];
  /** Bill type: Cash or Credit. */
  billType?: string | null;
  /** Cash amount paid at billing time. */
  cashPayment?: number | null;
  /** Bank amount paid at billing time. */
  bankPayment?: number | null;
  /**
   * Total bill amount (what the customer owes us).
   * A financial ledger DEBIT entry is posted only when this is > 0.
   */
  billAmount?: number | null;
  remarks?: string | null;
}

/**
 * Input for updating an existing Sales Bill.
 *
 * If `gatePassIds` is supplied, the old gate pass set is completely replaced:
 *   - Old gate passes are unlinked (salesBillId → null).
 *   - New gate passes are validated and linked.
 *   - Old bill items are deleted and re-loaded from the new gate passes.
 * If omitted, gate pass links and bill items are left unchanged.
 *
 * The financial ledger entry is always fully reversed and re-posted whenever
 * any field changes, so the ledger remains consistent with the updated header.
 */
export interface UpdateSalesBillInput {
  billDate?: string;
  gatePassIds?: [number, ...number[]];
  billType?: string | null;
  cashPayment?: number | null;
  bankPayment?: number | null;
  billAmount?: number | null;
  remarks?: string | null;
}

/** Filters for listing Sales Bills. */
export interface ListSalesBillsInput {
  salePartyId?: number;
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?: string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?: string;
  limit?: number;
  offset?: number;
}

/** A sales bill header row as stored in the database. */
export type SalesBillRow = typeof salesBillsTable.$inferSelect;

/** A sales bill item row as stored in the database. */
export type SalesBillItemRow = typeof salesBillItemsTable.$inferSelect;

/**
 * Full detail returned by get/create/update operations:
 * bill header + all bill items + IDs of the linked gate passes.
 */
export interface SalesBillDetail {
  bill: SalesBillRow;
  items: SalesBillItemRow[];
  /** IDs of all sale gate passes currently linked to this bill. */
  linkedGatePassIds: number[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SalesBillNotFoundError extends Error {
  constructor(id: number) {
    super(`Sales Bill not found: id=${id}`);
    this.name = "SalesBillNotFoundError";
  }
}

export class SalesBillPartyNotFoundError extends Error {
  constructor(salePartyId: number) {
    super(`Sale Party not found: id=${salePartyId}`);
    this.name = "SalesBillPartyNotFoundError";
  }
}

export class SalesBillGatePassNotFoundError extends Error {
  constructor(gatePassId: number) {
    super(
      `Sale Gate Pass not found or already linked to another bill: id=${gatePassId}`
    );
    this.name = "SalesBillGatePassNotFoundError";
  }
}

export class SalesBillGatePassPartyMismatchError extends Error {
  constructor(
    gatePassId: number,
    gpNumber: string,
    expectedPartyId: number,
    actualPartyId: number
  ) {
    super(
      `Sale Gate Pass ${gpNumber} (id=${gatePassId}) belongs to ` +
      `party id=${actualPartyId}, but this bill is for party id=${expectedPartyId}. ` +
      "All gate passes on a bill must belong to the same sale party."
    );
    this.name = "SalesBillGatePassPartyMismatchError";
  }
}

export class SalesBillValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesBillValidationError";
  }
}

// ---------------------------------------------------------------------------
// Internal numeric helpers
// ---------------------------------------------------------------------------

/** Formats a JS number to 3-decimal string for numeric(10,3) columns. */
function fmtQty(v: number): string {
  return v.toFixed(3);
}

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
    throw new SalesBillValidationError(`${field} must be in YYYY-MM-DD format.`);
  }
}

function validateBillAmount(amount: number | null | undefined): void {
  if (amount != null && (!isFinite(amount) || amount < 0)) {
    throw new SalesBillValidationError(
      "billAmount must be a non-negative finite number when provided."
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
 * @throws SalesBillPartyNotFoundError if the party does not exist.
 */
async function lockSaleParty(tx: Tx, salePartyId: number): Promise<void> {
  const rows = await tx
    .select({ id: salePartiesTable.id })
    .from(salePartiesTable)
    .where(eq(salePartiesTable.id, salePartyId))
    .for("update");

  if (rows.length === 0) {
    throw new SalesBillPartyNotFoundError(salePartyId);
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped: financial ledger balance
// ---------------------------------------------------------------------------

/**
 * Returns the most recent financial ledger balance for a sale party.
 * Must only be called after lockSaleParty() has been called for the same
 * salePartyId within the same transaction.
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
 * Posts a DEBIT entry to the sale party's financial ledger within tx.
 *
 * Ledger semantics for Sales Bills:
 *   Debit  = amount customer owes us (receivable increases).
 *   new_balance = current_balance + amount
 *
 * Only called when billAmount > 0.
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

/**
 * Posts a CREDIT entry to the sale party's financial ledger within tx.
 *
 * Used for reversals: a credit reduces the outstanding receivable balance.
 *   new_balance = current_balance − amount
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

// ---------------------------------------------------------------------------
// Transaction-scoped: gate pass validation and locking
// ---------------------------------------------------------------------------

type LockedGatePassData = {
  id: number;
  gpNumber: string;
  salePartyId: number;
  date: string;
  items: Array<{
    productId: number;
    qty: string | null;
    gazana: string | null;
    rate: string | null;
    finalRate: string | null;
    total: string | null;
  }>;
};

/**
 * Locks each requested gate pass row FOR UPDATE, then validates:
 *   1. The gate pass exists.
 *   2. It is unlinked (salesBillId IS NULL).
 *   3. It belongs to the expected sale party.
 *
 * Lock order: gate passes are always fetched in ascending id order to prevent
 * deadlocks when two concurrent requests select overlapping gate passes.
 *
 * @throws SalesBillGatePassNotFoundError if any gate pass is not found or
 *         already linked.
 * @throws SalesBillGatePassPartyMismatchError if any gate pass belongs to a
 *         different sale party.
 */
async function lockAndValidateGatePasses(
  tx: Tx,
  gatePassIds: number[],
  expectedPartyId: number
): Promise<LockedGatePassData[]> {
  // Sort IDs ascending for consistent lock ordering (deadlock prevention).
  const sortedIds = [...new Set(gatePassIds)].sort((a, b) => a - b);

  // Fetch and lock all selected gate passes in one statement.
  const gatePasses = await tx
    .select({
      id:          saleGatePassesTable.id,
      gpNumber:    saleGatePassesTable.gpNumber,
      salePartyId: saleGatePassesTable.salePartyId,
      date:        saleGatePassesTable.date,
      salesBillId: saleGatePassesTable.salesBillId,
    })
    .from(saleGatePassesTable)
    .where(
      and(
        inArray(saleGatePassesTable.id, sortedIds),
        isNull(saleGatePassesTable.salesBillId)    // must be unlinked
      )
    )
    .orderBy(asc(saleGatePassesTable.id))
    .for("update");

  // Verify every requested ID was found (and was unlinked).
  const foundIds = new Set(gatePasses.map((gp) => gp.id));
  for (const id of sortedIds) {
    if (!foundIds.has(id)) {
      throw new SalesBillGatePassNotFoundError(id);
    }
  }

  // Verify all belong to the expected party and load their items.
  const result: LockedGatePassData[] = [];

  for (const gp of gatePasses) {
    if (gp.salePartyId !== expectedPartyId) {
      throw new SalesBillGatePassPartyMismatchError(
        gp.id,
        gp.gpNumber,
        expectedPartyId,
        gp.salePartyId
      );
    }

    const items = await tx
      .select({
        productId: saleGatePassItemsTable.productId,
        qty:       saleGatePassItemsTable.qty,
        gazana:    saleGatePassItemsTable.gazana,
        rate:      saleGatePassItemsTable.rate,
        finalRate: saleGatePassItemsTable.finalRate,
        total:     saleGatePassItemsTable.total,
      })
      .from(saleGatePassItemsTable)
      .where(eq(saleGatePassItemsTable.saleGatePassId, gp.id))
      .orderBy(asc(saleGatePassItemsTable.id));

    result.push({
      id:          gp.id,
      gpNumber:    gp.gpNumber,
      salePartyId: gp.salePartyId,
      date:        gp.date,
      items,
    });
  }

  return result;
}

/**
 * Builds the list of sales_bill_items rows to insert from gate pass items.
 *
 * Items are deduplicated by productId across gate passes:
 *   - qty     : summed
 *   - gazana  : summed
 *   - total   : summed
 *   - rate    : last non-null value (unit price, not additive)
 *   - finalRate: last non-null value (unit price, not additive)
 *
 * Only items where qty > 0 are included.
 */
function buildBillItems(
  gatePasses: LockedGatePassData[]
): Array<{
  productId: number;
  qty: string;
  gazana: string | null;
  rate: string | null;
  finalRate: string | null;
  total: string | null;
}> {
  const map = new Map<
    number,
    {
      qty: number;
      gazana: number;
      rate: number | null;
      finalRate: number | null;
      total: number;
    }
  >();

  for (const gp of gatePasses) {
    for (const item of gp.items) {
      const qty = parseNum(item.qty);
      if (qty <= 0) continue;

      const existing = map.get(item.productId);
      if (existing) {
        existing.qty    += qty;
        existing.gazana += parseNum(item.gazana);
        existing.total  += parseNum(item.total);
        if (item.rate      != null) existing.rate      = parseNum(item.rate);
        if (item.finalRate != null) existing.finalRate = parseNum(item.finalRate);
      } else {
        map.set(item.productId, {
          qty,
          gazana:    parseNum(item.gazana),
          rate:      item.rate      != null ? parseNum(item.rate)      : null,
          finalRate: item.finalRate != null ? parseNum(item.finalRate) : null,
          total:     parseNum(item.total),
        });
      }
    }
  }

  return Array.from(map.entries()).map(([productId, acc]) => ({
    productId,
    qty:       fmtQty(acc.qty),
    gazana:    acc.gazana > 0             ? fmtQty(acc.gazana)       : null,
    rate:      acc.rate      != null      ? fmtMoney(acc.rate)        : null,
    finalRate: acc.finalRate != null      ? fmtMoney(acc.finalRate)   : null,
    total:     acc.total > 0              ? fmtMoney(acc.total)       : null,
  }));
}

// ---------------------------------------------------------------------------
// Shared: fetch locked bill (for update / delete)
// ---------------------------------------------------------------------------

/**
 * Locks the sales bill row FOR UPDATE and returns it.
 * Used by Update and Delete to prevent concurrent modifications.
 *
 * @throws SalesBillNotFoundError if the bill does not exist.
 */
async function fetchLockedBill(tx: Tx, id: number): Promise<SalesBillRow> {
  const rows = await tx
    .select()
    .from(salesBillsTable)
    .where(eq(salesBillsTable.id, id))
    .for("update");

  if (rows.length === 0) {
    throw new SalesBillNotFoundError(id);
  }

  return rows[0]!;
}

/**
 * Returns the IDs of all gate passes currently linked to a sales bill.
 * Plain read — no lock.
 */
async function fetchLinkedGatePassIds(
  tx: Tx,
  billId: number
): Promise<number[]> {
  const rows = await tx
    .select({ id: saleGatePassesTable.id })
    .from(saleGatePassesTable)
    .where(eq(saleGatePassesTable.salesBillId, billId))
    .orderBy(asc(saleGatePassesTable.id));

  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Sales Bill.
 *
 * Transaction sequence (after number generation):
 *   1. Lock sale party row (ledger anchor + existence check).
 *   2. Lock and validate all selected gate passes
 *      (unlinked + same party + FOR UPDATE).
 *   3. INSERT sales_bills header.
 *   4. INSERT sales_bill_items (auto-loaded from gate pass items).
 *   5. UPDATE each gate pass: set salesBillId = new bill id.
 *   6. If billAmount > 0: INSERT ledger DEBIT entry.
 *
 * All six steps commit or rollback together.
 * Stock is NOT touched — it was already posted during Sale Gate Pass creation.
 *
 * @throws SalesBillValidationError
 * @throws SalesBillPartyNotFoundError
 * @throws SalesBillGatePassNotFoundError
 * @throws SalesBillGatePassPartyMismatchError
 */
export async function createSalesBill(
  input: CreateSalesBillInput
): Promise<SalesBillDetail> {
  // --- Pre-flight validation (no I/O) ---
  validateDate(input.billDate, "billDate");
  validateBillAmount(input.billAmount);

  if (input.gatePassIds.length === 0) {
    throw new SalesBillValidationError(
      "At least one Sale Gate Pass ID is required."
    );
  }

  // Generate SB number before the main transaction (own committed transaction).
  const billNumber = await getNextDocumentNumber(DOCUMENT_TYPES.SalesBill);

  return db.transaction(async (tx) => {
    // Step 1 — lock party row (establishes ledger serialisation anchor).
    await lockSaleParty(tx, input.salePartyId);

    // Step 2 — lock and validate gate passes.
    const lockedGatePasses = await lockAndValidateGatePasses(
      tx,
      input.gatePassIds,
      input.salePartyId
    );

    // Step 3 — insert bill header.
    const billInserted = await tx
      .insert(salesBillsTable)
      .values({
        billNumber,
        billDate:     input.billDate,
        salePartyId:  input.salePartyId,
        billType:     input.billType     ?? null,
        cashPayment:  input.cashPayment  != null ? fmtMoney(input.cashPayment)  : null,
        bankPayment:  input.bankPayment  != null ? fmtMoney(input.bankPayment)  : null,
        billAmount:   input.billAmount   != null ? fmtMoney(input.billAmount)   : null,
        remarks:      input.remarks      ?? null,
      })
      .returning();

    const bill = billInserted[0]!;

    // Step 4 — auto-load items from gate passes into bill items.
    const billItemValues = buildBillItems(lockedGatePasses);
    let insertedItems: SalesBillItemRow[] = [];

    if (billItemValues.length > 0) {
      insertedItems = await tx
        .insert(salesBillItemsTable)
        .values(
          billItemValues.map((item) => ({
            salesBillId: bill.id,
            productId:   item.productId,
            qty:         item.qty,
            gazana:      item.gazana,
            rate:        item.rate,
            finalRate:   item.finalRate,
            total:       item.total,
          }))
        )
        .returning();
    }

    // Step 5 — link gate passes to this bill.
    await tx
      .update(saleGatePassesTable)
      .set({ salesBillId: bill.id, updatedAt: new Date() })
      .where(inArray(saleGatePassesTable.id, lockedGatePasses.map((gp) => gp.id)));

    // Step 6 — post financial ledger DEBIT entry (only if amount is provided).
    if (input.billAmount != null && input.billAmount > 0) {
      await insertLedgerDebit(tx, {
        salePartyId: input.salePartyId,
        date:        input.billDate,
        description: `Sales Bill - ${billNumber}`,
        refNo:       billNumber,
        amount:      input.billAmount,
      });
    }

    return {
      bill,
      items:             insertedItems,
      linkedGatePassIds: lockedGatePasses.map((gp) => gp.id),
    };
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Updates an existing Sales Bill.
 *
 * Full reversal-and-repost strategy for both gate passes and ledger:
 *
 * If `gatePassIds` is supplied (gate pass set changing):
 *   1.  Lock bill FOR UPDATE.
 *   2.  Lock party row.
 *   3.  Reverse existing ledger DEBIT (if any) via a compensating CREDIT.
 *   4.  Unlink all currently linked gate passes (salesBillId → null).
 *   5.  Delete all current bill items.
 *   6.  Lock and validate the new gate passes.
 *   7.  Update bill header.
 *   8.  Insert new bill items from new gate passes.
 *   9.  Link new gate passes to this bill.
 *   10. Post fresh ledger DEBIT if new billAmount > 0.
 *
 * If `gatePassIds` is NOT supplied (header-only update):
 *   1. Lock bill FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse existing ledger DEBIT (if any).
 *   4. Update bill header.
 *   5. Post fresh ledger DEBIT if new billAmount > 0.
 *   (Gate passes and bill items are left unchanged.)
 *
 * @throws SalesBillNotFoundError
 * @throws SalesBillValidationError
 * @throws SalesBillPartyNotFoundError
 * @throws SalesBillGatePassNotFoundError
 * @throws SalesBillGatePassPartyMismatchError
 */
export async function updateSalesBill(
  id: number,
  input: UpdateSalesBillInput
): Promise<SalesBillDetail> {
  if (input.billDate !== undefined) {
    validateDate(input.billDate, "billDate");
  }
  validateBillAmount(input.billAmount);

  if (input.gatePassIds !== undefined && input.gatePassIds.length === 0) {
    throw new SalesBillValidationError(
      "gatePassIds cannot be an empty array when provided."
    );
  }

  return db.transaction(async (tx) => {
    // Step 1 — lock the bill.
    const bill = await fetchLockedBill(tx, id);

    // Step 2 — lock the party row (FK guarantees it exists, but lock needed for ledger).
    await lockSaleParty(tx, bill.salePartyId);

    // Step 3 — reverse the existing ledger DEBIT if one was previously posted.
    const oldBillAmount = parseNum(bill.billAmount);
    if (oldBillAmount > 0) {
      await insertLedgerCredit(tx, {
        salePartyId: bill.salePartyId,
        date:        bill.billDate,
        description: `Reversal - ${bill.billNumber}`,
        refNo:       bill.billNumber,
        amount:      oldBillAmount,
      });
    }

    // Steps 4–9 only when gate passes are changing.
    if (input.gatePassIds !== undefined) {
      // Step 4 — unlink all currently linked gate passes.
      const currentLinkedIds = await fetchLinkedGatePassIds(tx, id);
      if (currentLinkedIds.length > 0) {
        await tx
          .update(saleGatePassesTable)
          .set({ salesBillId: null, updatedAt: new Date() })
          .where(inArray(saleGatePassesTable.id, currentLinkedIds));
      }

      // Step 5 — delete all current bill items.
      await tx
        .delete(salesBillItemsTable)
        .where(eq(salesBillItemsTable.salesBillId, id));

      // Step 6 — lock and validate new gate passes.
      const lockedGatePasses = await lockAndValidateGatePasses(
        tx,
        input.gatePassIds,
        bill.salePartyId
      );

      // Resolve effective bill amount (new input overrides, otherwise keep old).
      const effectiveBillAmount =
        input.billAmount !== undefined ? input.billAmount : oldBillAmount;

      // Step 7 — update bill header.
      const updatedRows = await tx
        .update(salesBillsTable)
        .set({
          ...(input.billDate    !== undefined && { billDate:    input.billDate }),
          ...(input.billType    !== undefined && { billType:    input.billType }),
          ...(input.cashPayment !== undefined && {
            cashPayment: input.cashPayment != null ? fmtMoney(input.cashPayment) : null,
          }),
          ...(input.bankPayment !== undefined && {
            bankPayment: input.bankPayment != null ? fmtMoney(input.bankPayment) : null,
          }),
          ...(input.billAmount  !== undefined && {
            billAmount: input.billAmount != null ? fmtMoney(input.billAmount) : null,
          }),
          ...(input.remarks     !== undefined && { remarks: input.remarks }),
          updatedAt: new Date(),
        })
        .where(eq(salesBillsTable.id, id))
        .returning();

      const updatedBill = updatedRows[0]!;

      // Step 8 — insert new bill items.
      const billItemValues = buildBillItems(lockedGatePasses);
      let newItems: SalesBillItemRow[] = [];

      if (billItemValues.length > 0) {
        newItems = await tx
          .insert(salesBillItemsTable)
          .values(
            billItemValues.map((item) => ({
              salesBillId: id,
              productId:   item.productId,
              qty:         item.qty,
              gazana:      item.gazana,
              rate:        item.rate,
              finalRate:   item.finalRate,
              total:       item.total,
            }))
          )
          .returning();
      }

      // Step 9 — link new gate passes.
      await tx
        .update(saleGatePassesTable)
        .set({ salesBillId: id, updatedAt: new Date() })
        .where(inArray(saleGatePassesTable.id, lockedGatePasses.map((gp) => gp.id)));

      // Step 10 — post fresh ledger DEBIT.
      if (effectiveBillAmount != null && effectiveBillAmount > 0) {
        const effectiveDate = input.billDate ?? bill.billDate;
        await insertLedgerDebit(tx, {
          salePartyId: bill.salePartyId,
          date:        effectiveDate,
          description: `Sales Bill - ${bill.billNumber}`,
          refNo:       bill.billNumber,
          amount:      effectiveBillAmount,
        });
      }

      return {
        bill:             updatedBill,
        items:            newItems,
        linkedGatePassIds: lockedGatePasses.map((gp) => gp.id),
      };
    } else {
      // Header-only update (gate passes and items unchanged).

      const updatedRows = await tx
        .update(salesBillsTable)
        .set({
          ...(input.billDate    !== undefined && { billDate:    input.billDate }),
          ...(input.billType    !== undefined && { billType:    input.billType }),
          ...(input.cashPayment !== undefined && {
            cashPayment: input.cashPayment != null ? fmtMoney(input.cashPayment) : null,
          }),
          ...(input.bankPayment !== undefined && {
            bankPayment: input.bankPayment != null ? fmtMoney(input.bankPayment) : null,
          }),
          ...(input.billAmount  !== undefined && {
            billAmount: input.billAmount != null ? fmtMoney(input.billAmount) : null,
          }),
          ...(input.remarks     !== undefined && { remarks: input.remarks }),
          updatedAt: new Date(),
        })
        .where(eq(salesBillsTable.id, id))
        .returning();

      const updatedBill = updatedRows[0]!;

      // Post fresh ledger DEBIT for the new effective amount.
      const effectiveBillAmount =
        input.billAmount !== undefined ? input.billAmount : oldBillAmount;
      const effectiveDate = input.billDate ?? bill.billDate;

      if (effectiveBillAmount != null && effectiveBillAmount > 0) {
        await insertLedgerDebit(tx, {
          salePartyId: bill.salePartyId,
          date:        effectiveDate,
          description: `Sales Bill - ${bill.billNumber}`,
          refNo:       bill.billNumber,
          amount:      effectiveBillAmount,
        });
      }

      // Re-fetch items and gate pass ids (unchanged).
      const items = await tx
        .select()
        .from(salesBillItemsTable)
        .where(eq(salesBillItemsTable.salesBillId, id))
        .orderBy(asc(salesBillItemsTable.id));

      const finalLinkedGatePassIds = await fetchLinkedGatePassIds(tx, id);

      return {
        bill:             updatedBill,
        items,
        linkedGatePassIds: finalLinkedGatePassIds,
      };
    }
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Deletes a Sales Bill and reverses all its financial effects.
 *
 * Transaction sequence:
 *   1. Lock bill FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse ledger DEBIT via compensating CREDIT entry (if amount was posted).
 *   4. Unlink all linked gate passes (salesBillId → null).
 *   5. Delete bill items explicitly.
 *   6. Delete bill header.
 *
 * Stock ledger is NEVER modified — stock was managed at gate pass level.
 * Original ledger DEBIT rows are NEVER deleted — only a compensating CREDIT is added.
 *
 * @throws SalesBillNotFoundError
 */
export async function deleteSalesBill(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Step 1 — lock bill.
    const bill = await fetchLockedBill(tx, id);

    // Step 2 — lock party row.
    await lockSaleParty(tx, bill.salePartyId);

    // Step 3 — reverse ledger DEBIT if one was posted.
    const oldBillAmount = parseNum(bill.billAmount);
    if (oldBillAmount > 0) {
      await insertLedgerCredit(tx, {
        salePartyId: bill.salePartyId,
        date:        bill.billDate,
        description: `Reversal (Deleted) - ${bill.billNumber}`,
        refNo:       bill.billNumber,
        amount:      oldBillAmount,
      });
    }

    // Step 4 — unlink all gate passes linked to this bill.
    const linkedIds = await fetchLinkedGatePassIds(tx, id);
    if (linkedIds.length > 0) {
      await tx
        .update(saleGatePassesTable)
        .set({ salesBillId: null, updatedAt: new Date() })
        .where(inArray(saleGatePassesTable.id, linkedIds));
    }

    // Step 5 — delete bill items explicitly.
    await tx
      .delete(salesBillItemsTable)
      .where(eq(salesBillItemsTable.salesBillId, id));

    // Step 6 — delete bill header.
    await tx
      .delete(salesBillsTable)
      .where(eq(salesBillsTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

/**
 * Returns a Sales Bill with its items and linked gate pass IDs.
 * Returns null if not found (no error thrown).
 */
export async function getSalesBill(
  id: number
): Promise<SalesBillDetail | null> {
  const billRows = await db
    .select()
    .from(salesBillsTable)
    .where(eq(salesBillsTable.id, id));

  if (billRows.length === 0) return null;

  const bill = billRows[0]!;

  const [items, linkedGatePassRows] = await Promise.all([
    db
      .select()
      .from(salesBillItemsTable)
      .where(eq(salesBillItemsTable.salesBillId, id))
      .orderBy(asc(salesBillItemsTable.id)),
    db
      .select({ id: saleGatePassesTable.id })
      .from(saleGatePassesTable)
      .where(eq(saleGatePassesTable.salesBillId, id))
      .orderBy(asc(saleGatePassesTable.id)),
  ]);

  return {
    bill,
    items,
    linkedGatePassIds: linkedGatePassRows.map((r) => r.id),
  };
}

/**
 * Returns a Sales Bill by its document number (e.g. "SB0001").
 * Returns null if not found.
 */
export async function getSalesBillByNumber(
  billNumber: string
): Promise<SalesBillDetail | null> {
  const billRows = await db
    .select()
    .from(salesBillsTable)
    .where(eq(salesBillsTable.billNumber, billNumber));

  if (billRows.length === 0) return null;

  return getSalesBill(billRows[0]!.id);
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of Sales Bill headers.
 *
 * Items and linked gate passes are NOT included in list results.
 * Use getSalesBill() when the user opens a specific record.
 *
 * Ordered newest first (descending by billDate, then by id).
 */
export async function listSalesBills(
  input: ListSalesBillsInput = {}
): Promise<{ rows: SalesBillRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.salePartyId !== undefined) {
    conditions.push(eq(salesBillsTable.salePartyId, input.salePartyId));
  }
  if (input.fromDate !== undefined) {
    conditions.push(gte(salesBillsTable.billDate, input.fromDate));
  }
  if (input.toDate !== undefined) {
    conditions.push(lte(salesBillsTable.billDate, input.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(salesBillsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),
    db
      .select()
      .from(salesBillsTable)
      .where(where)
      .orderBy(desc(salesBillsTable.billDate), desc(salesBillsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
