/**
 * Purchase Bill Service
 *
 * Owns the full lifecycle of Purchase Bills:
 *   Create → Update → Delete → Get / List
 *
 * Integrations (per approved architecture):
 *   - Number Series Service : generates the PB document number (own transaction,
 *                             called before the main transaction — gaps on failure
 *                             are acceptable and normal in ERP systems).
 *   - Financial Ledger      : DEBIT entries posted inline within the main transaction
 *                             using tx-scoped helpers.  Balance maintained as a running
 *                             total keyed on purchase_party_id.
 *   - Gate Passes           : purchase_gate_passes.purchase_bill_id is updated within
 *                             the same transaction as the bill header.
 *
 * Scope boundaries (hard rules):
 *   - Never touches stock_ledger_entries.  Stock was already posted during
 *     Purchase Gate Pass (via receivedQty).  Purchase Bill is financial only.
 *   - Never generates any document number other than PB.
 *   - All gate passes on one bill must belong to the same purchase party.
 *   - Only unlinked gate passes (purchaseBillId IS NULL) may be selected.
 *   - Financial ledger reversals use compensating entries (credit) — original
 *     debit rows are never deleted.
 *   - Gate pass links are always fully restored (NULL) before a bill is deleted
 *     or its gate pass selection changes.
 */

import { eq, desc, and, gte, lte, asc, isNull, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  purchaseBillsTable,
  purchaseBillItemsTable,
  purchaseGatePassesTable,
  purchaseGatePassItemsTable,
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
// Public input / output types
// ---------------------------------------------------------------------------

/** Input for creating a new Purchase Bill. */
export interface CreatePurchaseBillInput {
  purchasePartyId: number;
  /** ISO calendar date — "YYYY-MM-DD". */
  billDate: string;
  /**
   * One or more unlinked Purchase Gate Pass IDs to include in this bill.
   * All must belong to the same purchasePartyId.
   * At least one is required.
   */
  gatePassIds: [number, ...number[]];
  /** Supplier's own bill / invoice number for reference. */
  supplierBillNumber?: string | null;
  /** Lot number (shared with gate passes). */
  lotNumber?: string | null;
  /**
   * Total bill amount (what we owe the supplier).
   * A financial ledger DEBIT entry is posted only when this is > 0.
   */
  billAmount?: number | null;
  remarks?: string | null;
}

/**
 * Input for updating an existing Purchase Bill.
 *
 * If `gatePassIds` is supplied, the old gate pass set is completely replaced:
 *   - Old gate passes are unlinked (purchaseBillId → null).
 *   - New gate passes are validated and linked.
 *   - Old bill items are deleted and re-loaded from the new gate passes.
 * If omitted, gate pass links and bill items are left unchanged.
 *
 * The financial ledger entry is always fully reversed and re-posted whenever
 * any field changes, so the ledger remains consistent with the updated header.
 */
export interface UpdatePurchaseBillInput {
  billDate?: string;
  gatePassIds?: [number, ...number[]];
  supplierBillNumber?: string | null;
  lotNumber?: string | null;
  billAmount?: number | null;
  remarks?: string | null;
}

/** Filters for listing Purchase Bills. */
export interface ListPurchaseBillsInput {
  purchasePartyId?: number;
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?: string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?: string;
  limit?: number;
  offset?: number;
}

/** A purchase bill header row as stored in the database. */
export type PurchaseBillRow = typeof purchaseBillsTable.$inferSelect;

/** A purchase bill item row as stored in the database. */
export type PurchaseBillItemRow = typeof purchaseBillItemsTable.$inferSelect;

/**
 * Full detail returned by get/create/update operations:
 * bill header + all bill items + IDs of the linked gate passes.
 */
export interface PurchaseBillDetail {
  bill: PurchaseBillRow;
  items: PurchaseBillItemRow[];
  /** IDs of all purchase gate passes currently linked to this bill. */
  linkedGatePassIds: number[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PurchaseBillNotFoundError extends Error {
  constructor(id: number) {
    super(`Purchase Bill not found: id=${id}`);
    this.name = "PurchaseBillNotFoundError";
  }
}

export class PurchaseBillPartyNotFoundError extends Error {
  constructor(purchasePartyId: number) {
    super(`Purchase Party not found: id=${purchasePartyId}`);
    this.name = "PurchaseBillPartyNotFoundError";
  }
}

export class PurchaseBillGatePassNotFoundError extends Error {
  constructor(gatePassId: number) {
    super(
      `Purchase Gate Pass not found or already linked to another bill: id=${gatePassId}`
    );
    this.name = "PurchaseBillGatePassNotFoundError";
  }
}

export class PurchaseBillGatePassPartyMismatchError extends Error {
  constructor(gatePassId: number, gpNumber: string, expectedPartyId: number, actualPartyId: number) {
    super(
      `Purchase Gate Pass ${gpNumber} (id=${gatePassId}) belongs to ` +
      `party id=${actualPartyId}, but this bill is for party id=${expectedPartyId}. ` +
      "All gate passes on a bill must belong to the same purchase party."
    );
    this.name = "PurchaseBillGatePassPartyMismatchError";
  }
}

export class PurchaseBillValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseBillValidationError";
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
    throw new PurchaseBillValidationError(
      `${field} must be in YYYY-MM-DD format.`
    );
  }
}

function validateBillAmount(amount: number | null | undefined): void {
  if (amount != null && (!isFinite(amount) || amount < 0)) {
    throw new PurchaseBillValidationError(
      "billAmount must be a non-negative finite number when provided."
    );
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped: purchase party locking
// ---------------------------------------------------------------------------

/**
 * Locks the purchase party row exclusively within a transaction.
 * This serialises all concurrent financial ledger writes for the same party,
 * including the very first entry (when no ledger rows exist yet).
 *
 * Must be called before any ledger read or write for this party within the tx.
 *
 * @throws PurchaseBillPartyNotFoundError if the party does not exist.
 */
async function lockPurchaseParty(tx: Tx, purchasePartyId: number): Promise<void> {
  const rows = await tx
    .select({ id: purchasePartiesTable.id })
    .from(purchasePartiesTable)
    .where(eq(purchasePartiesTable.id, purchasePartyId))
    .for("update");

  if (rows.length === 0) {
    throw new PurchaseBillPartyNotFoundError(purchasePartyId);
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped: financial ledger balance
// ---------------------------------------------------------------------------

/**
 * Returns the most recent financial ledger balance for a purchase party.
 * Must only be called after lockPurchaseParty() has been called for the
 * same purchasePartyId within the same transaction.
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
 * Posts a DEBIT entry to the purchase party's financial ledger within tx.
 *
 * Ledger semantics for Purchase Bills:
 *   Debit  = amount we OWE the supplier (liability increases).
 *   Balance grows with each debit (running total of outstanding payables).
 *
 * new_balance = current_balance + amount
 *
 * Only called when billAmount > 0.
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

/**
 * Posts a CREDIT entry to the purchase party's financial ledger within tx.
 *
 * Used for reversals: a credit reduces the outstanding payable balance.
 *   new_balance = current_balance − amount
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

// ---------------------------------------------------------------------------
// Transaction-scoped: gate pass validation and locking
// ---------------------------------------------------------------------------

type LockedGatePassData = {
  id: number;
  gpNumber: string;
  purchasePartyId: number;
  date: string;
  items: Array<{
    productId: number;
    receivedQty: string | null;
    qty: string | null;
  }>;
};

/**
 * Locks each requested gate pass row FOR UPDATE, then validates:
 *   1. The gate pass exists.
 *   2. It is unlinked (purchaseBillId IS NULL).
 *   3. It belongs to the expected purchase party.
 *
 * Lock order: gate passes are always fetched in ascending id order to prevent
 * deadlocks when two concurrent requests select overlapping gate passes.
 *
 * @returns The locked gate pass rows with their items pre-loaded.
 * @throws PurchaseBillGatePassNotFoundError if any gate pass is not found or
 *         already linked.
 * @throws PurchaseBillGatePassPartyMismatchError if any gate pass belongs to a
 *         different purchase party.
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
      id:              purchaseGatePassesTable.id,
      gpNumber:        purchaseGatePassesTable.gpNumber,
      purchasePartyId: purchaseGatePassesTable.purchasePartyId,
      date:            purchaseGatePassesTable.date,
      purchaseBillId:  purchaseGatePassesTable.purchaseBillId,
    })
    .from(purchaseGatePassesTable)
    .where(
      and(
        inArray(purchaseGatePassesTable.id, sortedIds),
        isNull(purchaseGatePassesTable.purchaseBillId)   // must be unlinked
      )
    )
    .orderBy(asc(purchaseGatePassesTable.id))
    .for("update");

  // Verify every requested ID was found (and was unlinked).
  const foundIds = new Set(gatePasses.map((gp) => gp.id));
  for (const id of sortedIds) {
    if (!foundIds.has(id)) {
      throw new PurchaseBillGatePassNotFoundError(id);
    }
  }

  // Verify all belong to the expected party and load their items.
  const result: LockedGatePassData[] = [];

  for (const gp of gatePasses) {
    if (gp.purchasePartyId !== expectedPartyId) {
      throw new PurchaseBillGatePassPartyMismatchError(
        gp.id,
        gp.gpNumber,
        expectedPartyId,
        gp.purchasePartyId
      );
    }

    const items = await tx
      .select({
        productId:   purchaseGatePassItemsTable.productId,
        receivedQty: purchaseGatePassItemsTable.receivedQty,
        qty:         purchaseGatePassItemsTable.qty,
      })
      .from(purchaseGatePassItemsTable)
      .where(eq(purchaseGatePassItemsTable.purchaseGatePassId, gp.id))
      .orderBy(asc(purchaseGatePassItemsTable.id));

    result.push({
      id:              gp.id,
      gpNumber:        gp.gpNumber,
      purchasePartyId: gp.purchasePartyId,
      date:            gp.date,
      items,
    });
  }

  return result;
}

/**
 * Builds the list of purchase_bill_items rows to insert from gate pass items.
 *
 * Quantity used: receivedQty (actual received) → falls back to qty when null.
 * Items are deduplicated by productId: if the same product appears across
 * multiple gate passes, quantities are summed.
 *
 * Only items where the resolved quantity > 0 are included.
 */
function buildBillItems(
  gatePasses: LockedGatePassData[]
): Array<{ productId: number; qty: string }> {
  const qtyByProduct = new Map<number, number>();

  for (const gp of gatePasses) {
    for (const item of gp.items) {
      const qty =
        item.receivedQty != null
          ? parseNum(item.receivedQty)
          : parseNum(item.qty);

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
 * Locks the purchase bill row FOR UPDATE and returns the current bill.
 * Used by Update and Delete to prevent concurrent modifications.
 *
 * @throws PurchaseBillNotFoundError if the bill does not exist.
 */
async function fetchLockedBill(tx: Tx, id: number): Promise<PurchaseBillRow> {
  const rows = await tx
    .select()
    .from(purchaseBillsTable)
    .where(eq(purchaseBillsTable.id, id))
    .for("update");

  if (rows.length === 0) {
    throw new PurchaseBillNotFoundError(id);
  }

  return rows[0]!;
}

/**
 * Returns the IDs of all gate passes currently linked to a bill.
 * Plain read — no lock.
 */
async function fetchLinkedGatePassIds(
  tx: Tx,
  billId: number
): Promise<number[]> {
  const rows = await tx
    .select({ id: purchaseGatePassesTable.id })
    .from(purchaseGatePassesTable)
    .where(eq(purchaseGatePassesTable.purchaseBillId, billId))
    .orderBy(asc(purchaseGatePassesTable.id));

  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Purchase Bill.
 *
 * Transaction sequence (after number generation):
 *   1. Lock purchase party row (ledger anchor + existence check).
 *   2. Lock and validate all selected gate passes
 *      (unlinked + same party + FOR UPDATE).
 *   3. INSERT purchase_bills header.
 *   4. INSERT purchase_bill_items (auto-loaded from gate pass items).
 *   5. UPDATE each gate pass: set purchaseBillId = new bill id.
 *   6. If billAmount > 0: INSERT ledger DEBIT entry.
 *
 * All six steps commit or rollback together.
 * Stock is NOT touched — it was already posted during Purchase Gate Pass creation.
 *
 * @throws PurchaseBillValidationError
 * @throws PurchaseBillPartyNotFoundError
 * @throws PurchaseBillGatePassNotFoundError
 * @throws PurchaseBillGatePassPartyMismatchError
 */
export async function createPurchaseBill(
  input: CreatePurchaseBillInput
): Promise<PurchaseBillDetail> {
  // --- Pre-flight validation (no I/O) ---
  validateDate(input.billDate, "billDate");
  validateBillAmount(input.billAmount);

  if (input.gatePassIds.length === 0) {
    throw new PurchaseBillValidationError(
      "At least one Purchase Gate Pass ID is required."
    );
  }

  // Generate PB number before the main transaction (own committed transaction).
  const billNumber = await getNextDocumentNumber(DOCUMENT_TYPES.PurchaseBill);

  return db.transaction(async (tx) => {
    // Step 1 — lock party row (establishes ledger serialisation anchor).
    await lockPurchaseParty(tx, input.purchasePartyId);

    // Step 2 — lock and validate gate passes.
    const lockedGatePasses = await lockAndValidateGatePasses(
      tx,
      input.gatePassIds,
      input.purchasePartyId
    );

    // Step 3 — insert bill header.
    const billInserted = await tx
      .insert(purchaseBillsTable)
      .values({
        billNumber,
        billDate:          input.billDate,
        purchasePartyId:   input.purchasePartyId,
        supplierBillNumber: input.supplierBillNumber ?? null,
        lotNumber:         input.lotNumber ?? null,
        billAmount:        input.billAmount != null ? fmtMoney(input.billAmount) : null,
        remarks:           input.remarks ?? null,
      })
      .returning();

    const bill = billInserted[0]!;

    // Step 4 — auto-load items from gate passes into bill items.
    const billItemValues = buildBillItems(lockedGatePasses);
    let insertedItems: PurchaseBillItemRow[] = [];

    if (billItemValues.length > 0) {
      insertedItems = await tx
        .insert(purchaseBillItemsTable)
        .values(
          billItemValues.map((item) => ({
            purchaseBillId: bill.id,
            productId:      item.productId,
            qty:            item.qty,
          }))
        )
        .returning();
    }

    // Step 5 — link gate passes to this bill.
    await tx
      .update(purchaseGatePassesTable)
      .set({ purchaseBillId: bill.id, updatedAt: new Date() })
      .where(inArray(purchaseGatePassesTable.id, lockedGatePasses.map((gp) => gp.id)));

    // Step 6 — post financial ledger DEBIT entry (only if amount is provided).
    if (input.billAmount != null && input.billAmount > 0) {
      await insertLedgerDebit(tx, {
        purchasePartyId: input.purchasePartyId,
        date:            input.billDate,
        description:     `Purchase Bill - ${billNumber}`,
        refNo:           billNumber,
        amount:          input.billAmount,
      });
    }

    return {
      bill,
      items:            insertedItems,
      linkedGatePassIds: lockedGatePasses.map((gp) => gp.id),
    };
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Updates an existing Purchase Bill.
 *
 * Full reversal-and-repost strategy for both gate passes and ledger:
 *
 * If `gatePassIds` is supplied (gate pass set changing):
 *   1. Lock bill FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse existing ledger DEBIT (if any) via a compensating CREDIT.
 *   4. Unlink all currently linked gate passes (purchaseBillId → null).
 *   5. Delete all current bill items.
 *   6. Lock and validate the new gate passes.
 *   7. Update bill header.
 *   8. Insert new bill items from new gate passes.
 *   9. Link new gate passes to this bill.
 *  10. Post fresh ledger DEBIT if new billAmount > 0.
 *
 * If `gatePassIds` is NOT supplied (header-only update):
 *   1. Lock bill FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse existing ledger DEBIT (if any).
 *   4. Update bill header.
 *   5. Post fresh ledger DEBIT if new billAmount > 0.
 *   (Gate passes and bill items are left unchanged.)
 *
 * @throws PurchaseBillNotFoundError
 * @throws PurchaseBillValidationError
 * @throws PurchaseBillPartyNotFoundError
 * @throws PurchaseBillGatePassNotFoundError
 * @throws PurchaseBillGatePassPartyMismatchError
 */
export async function updatePurchaseBill(
  id: number,
  input: UpdatePurchaseBillInput
): Promise<PurchaseBillDetail> {
  if (input.billDate !== undefined) {
    validateDate(input.billDate, "billDate");
  }
  validateBillAmount(input.billAmount);

  if (input.gatePassIds !== undefined && input.gatePassIds.length === 0) {
    throw new PurchaseBillValidationError(
      "gatePassIds cannot be an empty array when provided."
    );
  }

  return db.transaction(async (tx) => {
    // Step 1 — lock the bill.
    const bill = await fetchLockedBill(tx, id);

    // Step 2 — lock the party row (exists by FK guarantee, but lock needed for ledger).
    await lockPurchaseParty(tx, bill.purchasePartyId);

    // Step 3 — reverse the existing ledger DEBIT if one was previously posted.
    const oldBillAmount = parseNum(bill.billAmount);
    if (oldBillAmount > 0) {
      await insertLedgerCredit(tx, {
        purchasePartyId: bill.purchasePartyId,
        date:            bill.billDate,
        description:     `Reversal - ${bill.billNumber}`,
        refNo:           bill.billNumber,
        amount:          oldBillAmount,
      });
    }

    // Steps 4–9 only when gate passes are changing.
    let finalLinkedGatePassIds: number[];

    if (input.gatePassIds !== undefined) {
      // Step 4 — unlink all currently linked gate passes.
      const currentLinkedIds = await fetchLinkedGatePassIds(tx, id);
      if (currentLinkedIds.length > 0) {
        await tx
          .update(purchaseGatePassesTable)
          .set({ purchaseBillId: null, updatedAt: new Date() })
          .where(inArray(purchaseGatePassesTable.id, currentLinkedIds));
      }

      // Step 5 — delete all current bill items.
      await tx
        .delete(purchaseBillItemsTable)
        .where(eq(purchaseBillItemsTable.purchaseBillId, id));

      // Step 6 — lock and validate new gate passes.
      const lockedGatePasses = await lockAndValidateGatePasses(
        tx,
        input.gatePassIds,
        bill.purchasePartyId
      );

      // Resolve effective bill amount (new input overrides, otherwise keep old).
      const effectiveBillAmount =
        input.billAmount !== undefined ? input.billAmount : oldBillAmount;

      // Step 7 — update bill header.
      const updatedRows = await tx
        .update(purchaseBillsTable)
        .set({
          ...(input.billDate          !== undefined && { billDate: input.billDate }),
          ...(input.supplierBillNumber !== undefined && { supplierBillNumber: input.supplierBillNumber }),
          ...(input.lotNumber         !== undefined && { lotNumber: input.lotNumber }),
          ...(input.remarks           !== undefined && { remarks: input.remarks }),
          ...(input.billAmount        !== undefined && {
            billAmount: input.billAmount != null ? fmtMoney(input.billAmount) : null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(purchaseBillsTable.id, id))
        .returning();

      const updatedBill = updatedRows[0]!;

      // Step 8 — insert new bill items.
      const billItemValues = buildBillItems(lockedGatePasses);
      let newItems: PurchaseBillItemRow[] = [];

      if (billItemValues.length > 0) {
        newItems = await tx
          .insert(purchaseBillItemsTable)
          .values(
            billItemValues.map((item) => ({
              purchaseBillId: id,
              productId:      item.productId,
              qty:            item.qty,
            }))
          )
          .returning();
      }

      // Step 9 — link new gate passes.
      await tx
        .update(purchaseGatePassesTable)
        .set({ purchaseBillId: id, updatedAt: new Date() })
        .where(inArray(purchaseGatePassesTable.id, lockedGatePasses.map((gp) => gp.id)));

      // Step 10 — post fresh ledger DEBIT.
      if (effectiveBillAmount != null && effectiveBillAmount > 0) {
        const effectiveDate = input.billDate ?? bill.billDate;
        await insertLedgerDebit(tx, {
          purchasePartyId: bill.purchasePartyId,
          date:            effectiveDate,
          description:     `Purchase Bill - ${bill.billNumber}`,
          refNo:           bill.billNumber,
          amount:          effectiveBillAmount,
        });
      }

      finalLinkedGatePassIds = lockedGatePasses.map((gp) => gp.id);

      return {
        bill:             updatedBill,
        items:            newItems,
        linkedGatePassIds: finalLinkedGatePassIds,
      };
    } else {
      // Header-only update (gate passes and items unchanged).

      const updatedRows = await tx
        .update(purchaseBillsTable)
        .set({
          ...(input.billDate          !== undefined && { billDate: input.billDate }),
          ...(input.supplierBillNumber !== undefined && { supplierBillNumber: input.supplierBillNumber }),
          ...(input.lotNumber         !== undefined && { lotNumber: input.lotNumber }),
          ...(input.remarks           !== undefined && { remarks: input.remarks }),
          ...(input.billAmount        !== undefined && {
            billAmount: input.billAmount != null ? fmtMoney(input.billAmount) : null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(purchaseBillsTable.id, id))
        .returning();

      const updatedBill = updatedRows[0]!;

      // Post fresh ledger DEBIT for the new amount.
      const effectiveBillAmount =
        input.billAmount !== undefined ? input.billAmount : oldBillAmount;
      const effectiveDate = input.billDate ?? bill.billDate;

      if (effectiveBillAmount != null && effectiveBillAmount > 0) {
        await insertLedgerDebit(tx, {
          purchasePartyId: bill.purchasePartyId,
          date:            effectiveDate,
          description:     `Purchase Bill - ${bill.billNumber}`,
          refNo:           bill.billNumber,
          amount:          effectiveBillAmount,
        });
      }

      // Re-fetch items and gate pass ids (unchanged).
      const items = await tx
        .select()
        .from(purchaseBillItemsTable)
        .where(eq(purchaseBillItemsTable.purchaseBillId, id))
        .orderBy(asc(purchaseBillItemsTable.id));

      finalLinkedGatePassIds = await fetchLinkedGatePassIds(tx, id);

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
 * Deletes a Purchase Bill and reverses all its financial effects.
 *
 * Transaction sequence:
 *   1. Lock bill FOR UPDATE.
 *   2. Lock party row.
 *   3. Reverse ledger DEBIT via compensating CREDIT entry (if amount was posted).
 *   4. Unlink all linked gate passes (purchaseBillId → null).
 *   5. Delete bill items explicitly.
 *   6. Delete bill header.
 *
 * Stock ledger is NEVER modified — stock was managed at gate pass level.
 * Original ledger DEBIT rows are NEVER deleted — only a compensating CREDIT is added.
 *
 * @throws PurchaseBillNotFoundError
 */
export async function deletePurchaseBill(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Step 1 — lock bill.
    const bill = await fetchLockedBill(tx, id);

    // Step 2 — lock party row.
    await lockPurchaseParty(tx, bill.purchasePartyId);

    // Step 3 — reverse ledger DEBIT if one was posted.
    const oldBillAmount = parseNum(bill.billAmount);
    if (oldBillAmount > 0) {
      await insertLedgerCredit(tx, {
        purchasePartyId: bill.purchasePartyId,
        date:            bill.billDate,
        description:     `Reversal (Deleted) - ${bill.billNumber}`,
        refNo:           bill.billNumber,
        amount:          oldBillAmount,
      });
    }

    // Step 4 — unlink all gate passes linked to this bill.
    const linkedIds = await fetchLinkedGatePassIds(tx, id);
    if (linkedIds.length > 0) {
      await tx
        .update(purchaseGatePassesTable)
        .set({ purchaseBillId: null, updatedAt: new Date() })
        .where(inArray(purchaseGatePassesTable.id, linkedIds));
    }

    // Step 5 — delete bill items explicitly.
    await tx
      .delete(purchaseBillItemsTable)
      .where(eq(purchaseBillItemsTable.purchaseBillId, id));

    // Step 6 — delete bill header.
    await tx
      .delete(purchaseBillsTable)
      .where(eq(purchaseBillsTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

/**
 * Returns a Purchase Bill with its items and linked gate pass IDs.
 * Returns null if not found (no error thrown).
 */
export async function getPurchaseBill(
  id: number
): Promise<PurchaseBillDetail | null> {
  const billRows = await db
    .select()
    .from(purchaseBillsTable)
    .where(eq(purchaseBillsTable.id, id));

  if (billRows.length === 0) return null;

  const bill = billRows[0]!;

  const [items, linkedGatePassRows] = await Promise.all([
    db
      .select()
      .from(purchaseBillItemsTable)
      .where(eq(purchaseBillItemsTable.purchaseBillId, id))
      .orderBy(asc(purchaseBillItemsTable.id)),
    db
      .select({ id: purchaseGatePassesTable.id })
      .from(purchaseGatePassesTable)
      .where(eq(purchaseGatePassesTable.purchaseBillId, id))
      .orderBy(asc(purchaseGatePassesTable.id)),
  ]);

  return {
    bill,
    items,
    linkedGatePassIds: linkedGatePassRows.map((r) => r.id),
  };
}

/**
 * Returns a Purchase Bill by its document number (e.g. "PB0001").
 * Returns null if not found.
 */
export async function getPurchaseBillByNumber(
  billNumber: string
): Promise<PurchaseBillDetail | null> {
  const billRows = await db
    .select()
    .from(purchaseBillsTable)
    .where(eq(purchaseBillsTable.billNumber, billNumber));

  if (billRows.length === 0) return null;

  return getPurchaseBill(billRows[0]!.id);
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of Purchase Bill headers.
 *
 * Items and linked gate passes are NOT included in list results.
 * Use getPurchaseBill() when the user opens a specific record.
 *
 * Ordered newest first (descending by billDate, then by id).
 */
export async function listPurchaseBills(
  input: ListPurchaseBillsInput = {}
): Promise<PurchaseBillRow[]> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.purchasePartyId !== undefined) {
    conditions.push(
      eq(purchaseBillsTable.purchasePartyId, input.purchasePartyId)
    );
  }

  if (input.fromDate !== undefined) {
    conditions.push(gte(purchaseBillsTable.billDate, input.fromDate));
  }

  if (input.toDate !== undefined) {
    conditions.push(lte(purchaseBillsTable.billDate, input.toDate));
  }

  const query = db
    .select()
    .from(purchaseBillsTable)
    .orderBy(
      desc(purchaseBillsTable.billDate),
      desc(purchaseBillsTable.id)
    )
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}
