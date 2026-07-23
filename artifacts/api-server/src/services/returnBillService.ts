/**
 * Return Bill Service
 *
 * Owns the full lifecycle of Return Bills:
 *   Create → Update → Delete → Get / List
 *
 * Integrations (per approved architecture):
 *   - Number Series Service : generates the RB document number (own transaction,
 *                             called before the main transaction — gaps on failure
 *                             are acceptable and normal in ERP systems).
 *   - Financial Ledger      : CREDIT entries posted inline within the main transaction
 *                             using tx-scoped helpers. Balance maintained as a running
 *                             total keyed on sale_party_id.
 *   - Gate Passes           : return_gate_passes.return_bill_id is updated within
 *                             the same transaction as the bill header.
 *
 * Scope boundaries (hard rules):
 *   - Never touches stock_ledger_entries. Stock was already posted during
 *     Return Gate Pass (Fresh items only). Return Bill is financial only.
 *   - Never generates any document number other than RB.
 *   - All gate passes on one bill must belong to the same sale party.
 *   - Only unlinked gate passes (returnBillId IS NULL) may be selected.
 *   - Financial ledger reversals use compensating entries (debit) — original
 *     credit rows are never deleted.
 *   - Gate pass links are always fully restored (NULL) before a bill is deleted
 *     or its gate pass selection changes.
 *
 * Ledger semantics for Return Bills:
 *   Credit  = customer returned goods → outstanding receivable decreases.
 *             new_balance = current_balance − amount
 *   Debit   = compensating reversal when a return bill is voided.
 *             new_balance = current_balance + amount
 */

import { eq, desc, and, gte, lte, asc, isNull, inArray, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  returnBillsTable,
  returnBillItemsTable,
  returnGatePassesTable,
  returnGatePassItemsTable,
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

/** Input for creating a new Return Bill. */
export interface CreateReturnBillInput {
  salePartyId: number;
  /** ISO calendar date — "YYYY-MM-DD". */
  billDate: string;
  /**
   * One or more unlinked Return Gate Pass IDs to include in this bill.
   * All must belong to the same salePartyId.
   * At least one is required.
   */
  gatePassIds: [number, ...number[]];
  /**
   * Total return bill amount (credited back to the customer).
   * A financial ledger CREDIT entry is posted only when this is > 0.
   */
  billAmount?: number | null;
  remarks?: string | null;
}

/**
 * Input for updating an existing Return Bill.
 *
 * If `gatePassIds` is supplied, the old gate pass set is completely replaced:
 *   - Old gate passes are unlinked (returnBillId → null).
 *   - New gate passes are validated and linked.
 *   - Old bill items are deleted and re-loaded from the new gate passes.
 * If omitted, gate pass links and bill items are left unchanged.
 *
 * The financial ledger entry is always fully reversed and re-posted whenever
 * any field changes, keeping the ledger consistent with the updated header.
 */
export interface UpdateReturnBillInput {
  billDate?: string;
  gatePassIds?: [number, ...number[]];
  billAmount?: number | null;
  remarks?: string | null;
}

/** Filters for listing Return Bills. */
export interface ListReturnBillsInput {
  salePartyId?: number;
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?: string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?: string;
  limit?: number;
  offset?: number;
}

/** A return bill header row as stored in the database. */
export type ReturnBillRow = typeof returnBillsTable.$inferSelect;

/** A return bill item row as stored in the database. */
export type ReturnBillItemRow = typeof returnBillItemsTable.$inferSelect;

/**
 * Full detail returned by get/create/update operations:
 * bill header + all bill items + IDs of the linked gate passes.
 */
export interface ReturnBillDetail {
  bill: ReturnBillRow;
  items: ReturnBillItemRow[];
  /** IDs of all return gate passes currently linked to this bill. */
  linkedGatePassIds: number[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ReturnBillNotFoundError extends Error {
  constructor(id: number) {
    super(`Return Bill not found: id=${id}`);
    this.name = "ReturnBillNotFoundError";
  }
}

export class ReturnBillPartyNotFoundError extends Error {
  constructor(salePartyId: number) {
    super(`Sale Party not found: id=${salePartyId}`);
    this.name = "ReturnBillPartyNotFoundError";
  }
}

export class ReturnBillGatePassNotFoundError extends Error {
  constructor(gatePassId: number) {
    super(
      `Return Gate Pass not found or already linked to another bill: id=${gatePassId}`
    );
    this.name = "ReturnBillGatePassNotFoundError";
  }
}

export class ReturnBillGatePassPartyMismatchError extends Error {
  constructor(
    gatePassId: number,
    gpNumber: string,
    expectedPartyId: number,
    actualPartyId: number
  ) {
    super(
      `Return Gate Pass ${gpNumber} (id=${gatePassId}) belongs to ` +
      `party id=${actualPartyId}, but this bill is for party id=${expectedPartyId}. ` +
      "All gate passes on a bill must belong to the same sale party."
    );
    this.name = "ReturnBillGatePassPartyMismatchError";
  }
}

export class ReturnBillValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReturnBillValidationError";
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
    throw new ReturnBillValidationError(`${field} must be in YYYY-MM-DD format.`);
  }
}

function validateBillAmount(amount: number | null | undefined): void {
  if (amount != null && (!isFinite(amount) || amount < 0)) {
    throw new ReturnBillValidationError(
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
 * @throws ReturnBillPartyNotFoundError if the party does not exist.
 */
async function lockSaleParty(tx: Tx, salePartyId: number): Promise<void> {
  const rows = await tx
    .select({ id: salePartiesTable.id })
    .from(salePartiesTable)
    .where(eq(salePartiesTable.id, salePartyId))
    .for("update");

  if (rows.length === 0) {
    throw new ReturnBillPartyNotFoundError(salePartyId);
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
 * Posts a CREDIT entry to the sale party's financial ledger within tx.
 *
 * Return Bill semantics: goods returned → outstanding receivable decreases.
 *   new_balance = current_balance − amount
 *
 * Only called when billAmount > 0.
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
 * Used when voiding or updating a Return Bill:
 *   new_balance = current_balance + amount
 *
 * The original CREDIT row is never modified or deleted.
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
  }>;
};

/**
 * Locks each requested gate pass row FOR UPDATE, then validates:
 *   1. The gate pass exists.
 *   2. It is unlinked (returnBillId IS NULL).
 *   3. It belongs to the expected sale party.
 *
 * Lock order: gate passes are always fetched in ascending id order to prevent
 * deadlocks when two concurrent requests select overlapping gate passes.
 *
 * @throws ReturnBillGatePassNotFoundError if any gate pass is not found or
 *         already linked.
 * @throws ReturnBillGatePassPartyMismatchError if any gate pass belongs to a
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
      id:           returnGatePassesTable.id,
      gpNumber:     returnGatePassesTable.gpNumber,
      salePartyId:  returnGatePassesTable.salePartyId,
      date:         returnGatePassesTable.date,
      returnBillId: returnGatePassesTable.returnBillId,
    })
    .from(returnGatePassesTable)
    .where(
      and(
        inArray(returnGatePassesTable.id, sortedIds),
        isNull(returnGatePassesTable.returnBillId)    // must be unlinked
      )
    )
    .orderBy(asc(returnGatePassesTable.id))
    .for("update");

  // Verify every requested ID was found (and was unlinked).
  const foundIds = new Set(gatePasses.map((gp) => gp.id));
  for (const id of sortedIds) {
    if (!foundIds.has(id)) {
      throw new ReturnBillGatePassNotFoundError(id);
    }
  }

  // Verify all belong to the expected party and load their items.
  const result: LockedGatePassData[] = [];

  for (const gp of gatePasses) {
    if (gp.salePartyId !== expectedPartyId) {
      throw new ReturnBillGatePassPartyMismatchError(
        gp.id,
        gp.gpNumber,
        expectedPartyId,
        gp.salePartyId
      );
    }

    const items = await tx
      .select({
        productId: returnGatePassItemsTable.productId,
        qty:       returnGatePassItemsTable.qty,
      })
      .from(returnGatePassItemsTable)
      .where(eq(returnGatePassItemsTable.returnGatePassId, gp.id))
      .orderBy(asc(returnGatePassItemsTable.id));

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
 * Builds the list of return_bill_items rows to insert from return gate pass items.
 *
 * Items are deduplicated by productId across gate passes — qty is summed.
 * The return_gate_pass_items table only carries qty; gazana/rate/finalRate/total
 * are not available at gate pass level and are stored as null in bill items
 * (they can be added manually or in a future edit).
 *
 * Only items where qty > 0 are included.
 */
function buildBillItems(
  gatePasses: LockedGatePassData[]
): Array<{ productId: number; qty: string }> {
  const qtyByProduct = new Map<number, number>();

  for (const gp of gatePasses) {
    for (const item of gp.items) {
      const qty = parseNum(item.qty);
      if (qty > 0) {
        qtyByProduct.set(
          item.productId,
          (qtyByProduct.get(item.productId) ?? 0) + qty
        );
      }
    }
  }

  return Array.from(qtyByProduct.entries()).map(([productId, qty]) => ({
    productId,
    qty: fmtQty(qty),
  }));
}

// ---------------------------------------------------------------------------
// Shared: fetch locked bill (for update / delete)
// ---------------------------------------------------------------------------

/**
 * Locks the return bill row FOR UPDATE and returns it.
 * Used by Update and Delete to prevent concurrent modifications.
 *
 * @throws ReturnBillNotFoundError if the bill does not exist.
 */
async function fetchLockedBill(tx: Tx, id: number): Promise<ReturnBillRow> {
  const rows = await tx
    .select()
    .from(returnBillsTable)
    .where(eq(returnBillsTable.id, id))
    .for("update");

  if (rows.length === 0) {
    throw new ReturnBillNotFoundError(id);
  }

  return rows[0]!;
}

/**
 * Returns the IDs of all return gate passes currently linked to a return bill.
 * Plain read — no lock.
 */
async function fetchLinkedGatePassIds(
  tx: Tx,
  billId: number
): Promise<number[]> {
  const rows = await tx
    .select({ id: returnGatePassesTable.id })
    .from(returnGatePassesTable)
    .where(eq(returnGatePassesTable.returnBillId, billId))
    .orderBy(asc(returnGatePassesTable.id));

  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Return Bill.
 *
 * Transaction sequence (after number generation):
 *   1. Lock sale party row (ledger anchor + existence check).
 *   2. Lock and validate all selected gate passes
 *      (unlinked + same party + FOR UPDATE).
 *   3. INSERT return_bills header.
 *   4. INSERT return_bill_items (auto-loaded from gate pass items; qty summed).
 *   5. UPDATE each gate pass: set returnBillId = new bill id.
 *   6. If billAmount > 0: INSERT ledger CREDIT entry.
 *
 * All six steps commit or rollback together.
 * Stock is NOT touched — handled at Return Gate Pass level.
 *
 * @throws ReturnBillValidationError
 * @throws ReturnBillPartyNotFoundError
 * @throws ReturnBillGatePassNotFoundError
 * @throws ReturnBillGatePassPartyMismatchError
 */
export async function createReturnBill(
  input: CreateReturnBillInput
): Promise<ReturnBillDetail> {
  // --- Pre-flight validation (no I/O) ---
  validateDate(input.billDate, "billDate");
  validateBillAmount(input.billAmount);

  if (input.gatePassIds.length === 0) {
    throw new ReturnBillValidationError(
      "At least one Return Gate Pass ID is required."
    );
  }

  // Generate RB number before the main transaction (own committed transaction).
  const billNumber = await getNextDocumentNumber(DOCUMENT_TYPES.ReturnBill);

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
      .insert(returnBillsTable)
      .values({
        billNumber,
        billDate:    input.billDate,
        salePartyId: input.salePartyId,
        billAmount:  input.billAmount != null ? fmtMoney(input.billAmount) : null,
        remarks:     input.remarks ?? null,
      })
      .returning();

    const bill = billInserted[0]!;

    // Step 4 — auto-load items from gate passes into bill items (qty only).
    const billItemValues = buildBillItems(lockedGatePasses);
    let insertedItems: ReturnBillItemRow[] = [];

    if (billItemValues.length > 0) {
      insertedItems = await tx
        .insert(returnBillItemsTable)
        .values(
          billItemValues.map((item) => ({
            returnBillId: bill.id,
            productId:    item.productId,
            qty:          item.qty,
            gazana:       null,
            rate:         null,
            finalRate:    null,
            total:        null,
          }))
        )
        .returning();
    }

    // Step 5 — link gate passes to this bill.
    await tx
      .update(returnGatePassesTable)
      .set({ returnBillId: bill.id, updatedAt: new Date() })
      .where(inArray(returnGatePassesTable.id, lockedGatePasses.map((gp) => gp.id)));

    // Step 6 — post financial ledger CREDIT entry (only if amount is provided).
    if (input.billAmount != null && input.billAmount > 0) {
      await insertLedgerCredit(tx, {
        salePartyId: input.salePartyId,
        date:        input.billDate,
        description: `Return Bill - ${billNumber}`,
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
 * Updates an existing Return Bill.
 *
 * Full reversal-and-repost strategy for both gate passes and ledger:
 *
 * If `gatePassIds` is supplied (gate pass set changing):
 *   1.  Lock bill FOR UPDATE.
 *   2.  Lock party row.
 *   3.  Reverse existing ledger CREDIT (if any) via a compensating DEBIT.
 *   4.  Unlink all currently linked gate passes (returnBillId → null).
 *   5.  Delete all current bill items.
 *   6.  Lock and validate the new gate passes.
 *   7.  Update bill header.
 *   8.  Insert new bill items from new gate passes.
 *   9.  Link new gate passes to this bill.
 *   10. Post fresh ledger CREDIT if new billAmount > 0.
 *
 * If `gatePassIds` is NOT supplied (header-only update):
 *   1. Lock bill FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse existing ledger CREDIT (if any).
 *   4. Update bill header.
 *   5. Post fresh ledger CREDIT if new billAmount > 0.
 *   (Gate passes and bill items are left unchanged.)
 *
 * @throws ReturnBillNotFoundError
 * @throws ReturnBillValidationError
 * @throws ReturnBillPartyNotFoundError
 * @throws ReturnBillGatePassNotFoundError
 * @throws ReturnBillGatePassPartyMismatchError
 */
export async function updateReturnBill(
  id: number,
  input: UpdateReturnBillInput
): Promise<ReturnBillDetail> {
  if (input.billDate !== undefined) {
    validateDate(input.billDate, "billDate");
  }
  validateBillAmount(input.billAmount);

  if (input.gatePassIds !== undefined && input.gatePassIds.length === 0) {
    throw new ReturnBillValidationError(
      "gatePassIds cannot be an empty array when provided."
    );
  }

  return db.transaction(async (tx) => {
    // Step 1 — lock the bill.
    const bill = await fetchLockedBill(tx, id);

    // Step 2 — lock the party row (FK guarantees existence, lock needed for ledger).
    await lockSaleParty(tx, bill.salePartyId);

    // Step 3 — reverse the existing ledger CREDIT if one was previously posted.
    const oldBillAmount = parseNum(bill.billAmount);
    if (oldBillAmount > 0) {
      await insertLedgerDebit(tx, {
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
          .update(returnGatePassesTable)
          .set({ returnBillId: null, updatedAt: new Date() })
          .where(inArray(returnGatePassesTable.id, currentLinkedIds));
      }

      // Step 5 — delete all current bill items.
      await tx
        .delete(returnBillItemsTable)
        .where(eq(returnBillItemsTable.returnBillId, id));

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
        .update(returnBillsTable)
        .set({
          ...(input.billDate   !== undefined && { billDate:   input.billDate }),
          ...(input.billAmount !== undefined && {
            billAmount: input.billAmount != null ? fmtMoney(input.billAmount) : null,
          }),
          ...(input.remarks    !== undefined && { remarks: input.remarks }),
          updatedAt: new Date(),
        })
        .where(eq(returnBillsTable.id, id))
        .returning();

      const updatedBill = updatedRows[0]!;

      // Step 8 — insert new bill items.
      const billItemValues = buildBillItems(lockedGatePasses);
      let newItems: ReturnBillItemRow[] = [];

      if (billItemValues.length > 0) {
        newItems = await tx
          .insert(returnBillItemsTable)
          .values(
            billItemValues.map((item) => ({
              returnBillId: id,
              productId:    item.productId,
              qty:          item.qty,
              gazana:       null,
              rate:         null,
              finalRate:    null,
              total:        null,
            }))
          )
          .returning();
      }

      // Step 9 — link new gate passes.
      await tx
        .update(returnGatePassesTable)
        .set({ returnBillId: id, updatedAt: new Date() })
        .where(inArray(returnGatePassesTable.id, lockedGatePasses.map((gp) => gp.id)));

      // Step 10 — post fresh ledger CREDIT.
      if (effectiveBillAmount != null && effectiveBillAmount > 0) {
        const effectiveDate = input.billDate ?? bill.billDate;
        await insertLedgerCredit(tx, {
          salePartyId: bill.salePartyId,
          date:        effectiveDate,
          description: `Return Bill - ${bill.billNumber}`,
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
        .update(returnBillsTable)
        .set({
          ...(input.billDate   !== undefined && { billDate:   input.billDate }),
          ...(input.billAmount !== undefined && {
            billAmount: input.billAmount != null ? fmtMoney(input.billAmount) : null,
          }),
          ...(input.remarks    !== undefined && { remarks: input.remarks }),
          updatedAt: new Date(),
        })
        .where(eq(returnBillsTable.id, id))
        .returning();

      const updatedBill = updatedRows[0]!;

      // Post fresh ledger CREDIT for the new effective amount.
      const effectiveBillAmount =
        input.billAmount !== undefined ? input.billAmount : oldBillAmount;
      const effectiveDate = input.billDate ?? bill.billDate;

      if (effectiveBillAmount != null && effectiveBillAmount > 0) {
        await insertLedgerCredit(tx, {
          salePartyId: bill.salePartyId,
          date:        effectiveDate,
          description: `Return Bill - ${bill.billNumber}`,
          refNo:       bill.billNumber,
          amount:      effectiveBillAmount,
        });
      }

      // Re-fetch items and gate pass ids (unchanged).
      const items = await tx
        .select()
        .from(returnBillItemsTable)
        .where(eq(returnBillItemsTable.returnBillId, id))
        .orderBy(asc(returnBillItemsTable.id));

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
 * Deletes a Return Bill and reverses all its financial effects.
 *
 * Transaction sequence:
 *   1. Lock bill FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse ledger CREDIT via compensating DEBIT entry (if amount was posted).
 *   4. Unlink all linked gate passes (returnBillId → null).
 *   5. Delete bill items explicitly.
 *   6. Delete bill header.
 *
 * Stock ledger is NEVER modified — stock was managed at Return Gate Pass level.
 * Original ledger CREDIT rows are NEVER deleted — only a compensating DEBIT is added.
 *
 * @throws ReturnBillNotFoundError
 */
export async function deleteReturnBill(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Step 1 — lock bill.
    const bill = await fetchLockedBill(tx, id);

    // Step 2 — lock party row.
    await lockSaleParty(tx, bill.salePartyId);

    // Step 3 — reverse ledger CREDIT if one was posted.
    const oldBillAmount = parseNum(bill.billAmount);
    if (oldBillAmount > 0) {
      await insertLedgerDebit(tx, {
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
        .update(returnGatePassesTable)
        .set({ returnBillId: null, updatedAt: new Date() })
        .where(inArray(returnGatePassesTable.id, linkedIds));
    }

    // Step 5 — delete bill items explicitly.
    await tx
      .delete(returnBillItemsTable)
      .where(eq(returnBillItemsTable.returnBillId, id));

    // Step 6 — delete bill header.
    await tx
      .delete(returnBillsTable)
      .where(eq(returnBillsTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

/**
 * Returns a Return Bill with its items and linked gate pass IDs.
 * Returns null if not found (no error thrown).
 */
export async function getReturnBill(
  id: number
): Promise<ReturnBillDetail | null> {
  const billRows = await db
    .select()
    .from(returnBillsTable)
    .where(eq(returnBillsTable.id, id));

  if (billRows.length === 0) return null;

  const bill = billRows[0]!;

  const [items, linkedGatePassRows] = await Promise.all([
    db
      .select()
      .from(returnBillItemsTable)
      .where(eq(returnBillItemsTable.returnBillId, id))
      .orderBy(asc(returnBillItemsTable.id)),
    db
      .select({ id: returnGatePassesTable.id })
      .from(returnGatePassesTable)
      .where(eq(returnGatePassesTable.returnBillId, id))
      .orderBy(asc(returnGatePassesTable.id)),
  ]);

  return {
    bill,
    items,
    linkedGatePassIds: linkedGatePassRows.map((r) => r.id),
  };
}

/**
 * Returns a Return Bill by its document number (e.g. "RB0001").
 * Returns null if not found.
 */
export async function getReturnBillByNumber(
  billNumber: string
): Promise<ReturnBillDetail | null> {
  const billRows = await db
    .select()
    .from(returnBillsTable)
    .where(eq(returnBillsTable.billNumber, billNumber));

  if (billRows.length === 0) return null;

  return getReturnBill(billRows[0]!.id);
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of Return Bill headers.
 *
 * Items and linked gate passes are NOT included in list results.
 * Use getReturnBill() when the user opens a specific record.
 *
 * Ordered newest first (descending by billDate, then by id).
 */
export async function listReturnBills(
  input: ListReturnBillsInput = {}
): Promise<{ rows: ReturnBillRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.salePartyId !== undefined) {
    conditions.push(eq(returnBillsTable.salePartyId, input.salePartyId));
  }
  if (input.fromDate !== undefined) {
    conditions.push(gte(returnBillsTable.billDate, input.fromDate));
  }
  if (input.toDate !== undefined) {
    conditions.push(lte(returnBillsTable.billDate, input.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(returnBillsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),
    db
      .select()
      .from(returnBillsTable)
      .where(where)
      .orderBy(desc(returnBillsTable.billDate), desc(returnBillsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
