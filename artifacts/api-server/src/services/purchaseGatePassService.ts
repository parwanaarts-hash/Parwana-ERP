/**
 * Purchase Gate Pass Service
 *
 * Owns the full lifecycle of Purchase Gate Passes:
 *   Create → Update → Delete → Get / List
 *
 * Integrations (per approved architecture):
 *   - Number Series Service  : generates the PGP document number (own transaction,
 *                              called before the main transaction — gaps on failure
 *                              are acceptable and normal in ERP systems).
 *   - Stock Ledger           : IN entries created inline within the main transaction
 *                              using tx-scoped helpers, NOT via addStockIn() which
 *                              opens its own connection.  This guarantees that the
 *                              header, items, and every stock movement commit or
 *                              rollback together as a single atomic unit.
 *
 * Scope boundaries (hard rules):
 *   - Never touches financial ledger tables.
 *   - Never touches Purchase Bill tables.
 *   - Does not generate any document number other than PGP.
 *   - Update / Delete are blocked when the gate pass is already linked to a bill.
 *   - Stock reversal on Update / Delete is done via compensating entries
 *     (OUT entries), never by deleting existing stock ledger rows.
 */

import { eq, desc, and, gte, lte, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  purchaseGatePassesTable,
  purchaseGatePassItemsTable,
  purchasePartiesTable,
  productsTable,
  stockLedgerEntriesTable,
} from "@workspace/db/schema";
import {
  DOCUMENT_TYPES,
  getNextDocumentNumber,
} from "./numberSeriesService";

// ---------------------------------------------------------------------------
// Internal transaction type
// ---------------------------------------------------------------------------

/** Drizzle transaction object — same connection as the outer BEGIN/COMMIT. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Public input / output types
// ---------------------------------------------------------------------------

/**
 * A single line item on the gate pass as supplied by the caller.
 *
 * qty        — quantity written on the supplier's physical gate pass
 * gazana     — per-piece Guz measurement (for Than-type products)
 * rate       — rate per unit
 * receivedQty — quantity physically received in the warehouse.
 *               ONLY this value affects stock.  qty is informational.
 *               Planning document: "Sirf Received Quantity Stock mein add hogi."
 */
export interface PurchaseGatePassItemInput {
  productId: number;
  qty?: number | null;
  gazana?: number | null;
  rate?: number | null;
  receivedQty?: number | null;
}

/** Input for creating a new Purchase Gate Pass. */
export interface CreatePurchaseGatePassInput {
  purchasePartyId: number;
  /** ISO calendar date — "YYYY-MM-DD". */
  date: string;
  /** Lot number shared between the supplier gate pass and the purchase bill. */
  lotNumber: string;
  remarks?: string | null;
  /** At least one item is required. */
  items: [PurchaseGatePassItemInput, ...PurchaseGatePassItemInput[]];
}

/**
 * Input for updating an existing Purchase Gate Pass.
 *
 * Supplying `items` replaces ALL existing items completely.
 * Old stock is reversed via compensating OUT entries before new stock is posted.
 */
export interface UpdatePurchaseGatePassInput {
  date?: string;
  lotNumber?: string;
  remarks?: string | null;
  /** If provided, replaces all items. Must be non-empty when supplied. */
  items?: [PurchaseGatePassItemInput, ...PurchaseGatePassItemInput[]];
}

/** Filters for listing Purchase Gate Passes. */
export interface ListPurchaseGatePassesInput {
  purchasePartyId?: number;
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?: string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?: string;
  /** true = only gate passes not yet linked to a bill. */
  unlinkedOnly?: boolean;
  limit?: number;
  offset?: number;
}

/** A gate pass header row as stored in the database. */
export type PurchaseGatePassRow =
  typeof purchaseGatePassesTable.$inferSelect;

/** A gate pass item row as stored in the database. */
export type PurchaseGatePassItemRow =
  typeof purchaseGatePassItemsTable.$inferSelect;

/** Gate pass header + all its items returned as a single unit. */
export interface PurchaseGatePassWithItems {
  gatePass: PurchaseGatePassRow;
  items: PurchaseGatePassItemRow[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PurchaseGatePassNotFoundError extends Error {
  constructor(id: number) {
    super(`Purchase Gate Pass not found: id=${id}`);
    this.name = "PurchaseGatePassNotFoundError";
  }
}

export class PurchaseGatePassLinkedToBillError extends Error {
  constructor(id: number, gpNumber: string) {
    super(
      `Purchase Gate Pass ${gpNumber} (id=${id}) is already linked to a ` +
      "Purchase Bill and cannot be modified or deleted. " +
      "Unlink the bill first."
    );
    this.name = "PurchaseGatePassLinkedToBillError";
  }
}

export class PurchasePartyNotFoundError extends Error {
  constructor(purchasePartyId: number) {
    super(`Purchase Party not found: id=${purchasePartyId}`);
    this.name = "PurchasePartyNotFoundError";
  }
}

export class PurchaseGatePassProductNotFoundError extends Error {
  constructor(productId: number) {
    super(`Product not found: id=${productId} (referenced in gate pass items)`);
    this.name = "PurchaseGatePassProductNotFoundError";
  }
}

export class PurchaseGatePassValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseGatePassValidationError";
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
// Internal validation helpers (run before the transaction opens)
// ---------------------------------------------------------------------------

/** Validates all item inputs before any DB work begins. */
function validateItems(items: PurchaseGatePassItemInput[]): void {
  if (items.length === 0) {
    throw new PurchaseGatePassValidationError(
      "At least one item is required on a Purchase Gate Pass."
    );
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!Number.isInteger(item.productId) || item.productId <= 0) {
      throw new PurchaseGatePassValidationError(
        `Item[${i}]: productId must be a positive integer.`
      );
    }
    if (item.qty != null && (item.qty <= 0 || !isFinite(item.qty))) {
      throw new PurchaseGatePassValidationError(
        `Item[${i}]: qty must be a positive finite number when provided.`
      );
    }
    if (item.gazana != null && (item.gazana <= 0 || !isFinite(item.gazana))) {
      throw new PurchaseGatePassValidationError(
        `Item[${i}]: gazana must be a positive finite number when provided.`
      );
    }
    if (item.rate != null && (item.rate <= 0 || !isFinite(item.rate))) {
      throw new PurchaseGatePassValidationError(
        `Item[${i}]: rate must be a positive finite number when provided.`
      );
    }
    if (item.receivedQty != null && (item.receivedQty <= 0 || !isFinite(item.receivedQty))) {
      throw new PurchaseGatePassValidationError(
        `Item[${i}]: receivedQty must be a positive finite number when provided.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped stock ledger helpers
//
// These replicate the locking pattern from stockLedgerService but accept the
// outer `tx` so that stock writes are part of the same atomic transaction as
// the gate pass header and items.  Using db.transaction() (which opens a new
// connection) inside an existing db.transaction() would create an independent
// transaction — these helpers avoid that problem entirely.
// ---------------------------------------------------------------------------

/**
 * Validates that a product exists and acquires an exclusive row lock on it.
 * Serialises all concurrent stock writes for the same product within the tx.
 *
 * @throws PurchaseGatePassProductNotFoundError if productId not found.
 */
async function lockProductForStock(tx: Tx, productId: number): Promise<void> {
  const rows = await tx
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .for("update");

  if (rows.length === 0) {
    throw new PurchaseGatePassProductNotFoundError(productId);
  }
}

/**
 * Reads the most recent stock balance for a product.
 * Must only be called after lockProductForStock() has been called for the
 * same productId within the same transaction.
 */
async function getLatestStockBalance(tx: Tx, productId: number): Promise<number> {
  const rows = await tx
    .select({ balance: stockLedgerEntriesTable.balance })
    .from(stockLedgerEntriesTable)
    .where(eq(stockLedgerEntriesTable.productId, productId))
    .orderBy(desc(stockLedgerEntriesTable.id))
    .limit(1);

  return rows.length > 0 ? parseNum(rows[0]!.balance) : 0;
}

/** Inserts a stock IN entry within an existing transaction. */
async function insertStockIn(
  tx: Tx,
  params: {
    productId: number;
    date: string;
    description: string;
    refNo: string;
    inQty: number;
  }
): Promise<void> {
  await lockProductForStock(tx, params.productId);
  const currentBalance = await getLatestStockBalance(tx, params.productId);
  const newBalance = currentBalance + params.inQty;

  await tx
    .insert(stockLedgerEntriesTable)
    .values({
      productId:   params.productId,
      date:        params.date,
      description: params.description,
      refNo:       params.refNo,
      inQty:       fmtQty(params.inQty),
      outQty:      null,
      balance:     fmtQty(newBalance),
    });
}

/**
 * Inserts a compensating stock OUT entry within an existing transaction.
 * Used to reverse a previously posted IN quantity (on Update or Delete).
 */
async function insertStockOut(
  tx: Tx,
  params: {
    productId: number;
    date: string;
    description: string;
    refNo: string;
    outQty: number;
  }
): Promise<void> {
  await lockProductForStock(tx, params.productId);
  const currentBalance = await getLatestStockBalance(tx, params.productId);
  const newBalance = currentBalance - params.outQty;

  await tx
    .insert(stockLedgerEntriesTable)
    .values({
      productId:   params.productId,
      date:        params.date,
      description: params.description,
      refNo:       params.refNo,
      inQty:       null,
      outQty:      fmtQty(params.outQty),
      balance:     fmtQty(newBalance),
    });
}

// ---------------------------------------------------------------------------
// Shared: fetch gate pass with items inside a transaction (with row lock)
// ---------------------------------------------------------------------------

/**
 * Fetches the gate pass header (with FOR UPDATE lock) and its items.
 * Used by Update and Delete to ensure no concurrent modifications.
 */
async function fetchLockedGatePass(
  tx: Tx,
  id: number
): Promise<{
  gatePass: PurchaseGatePassRow;
  items: PurchaseGatePassItemRow[];
}> {
  const gatePassRows = await tx
    .select()
    .from(purchaseGatePassesTable)
    .where(eq(purchaseGatePassesTable.id, id))
    .for("update");

  if (gatePassRows.length === 0) {
    throw new PurchaseGatePassNotFoundError(id);
  }

  const gatePass = gatePassRows[0]!;

  if (gatePass.purchaseBillId !== null) {
    throw new PurchaseGatePassLinkedToBillError(id, gatePass.gpNumber);
  }

  const items = await tx
    .select()
    .from(purchaseGatePassItemsTable)
    .where(eq(purchaseGatePassItemsTable.purchaseGatePassId, id))
    .orderBy(asc(purchaseGatePassItemsTable.id));

  return { gatePass, items };
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Purchase Gate Pass with all its items.
 *
 * Steps (all atomic except number generation):
 *   1. Validate inputs (before any I/O).
 *   2. Generate the next PGP document number (own committed transaction).
 *   3. Open the main transaction:
 *      a. Verify the purchase party exists.
 *      b. Verify all product IDs exist.
 *      c. Insert the gate pass header.
 *      d. Insert all items.
 *      e. For each item with receivedQty > 0: insert a stock IN entry
 *         (with product row lock to maintain balance integrity).
 *   4. Return the saved gate pass with items.
 *
 * If the main transaction fails, the PGP number is consumed but not used
 * (a gap in the sequence).  This is standard ERP behaviour.
 */
export async function createPurchaseGatePass(
  input: CreatePurchaseGatePassInput
): Promise<PurchaseGatePassWithItems> {
  // Step 1 — validate before any I/O.
  validateItems(input.items);

  if (!input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new PurchaseGatePassValidationError(
      "date must be in YYYY-MM-DD format."
    );
  }
  if (!input.lotNumber.trim()) {
    throw new PurchaseGatePassValidationError("lotNumber cannot be empty.");
  }

  // Step 2 — generate document number (commits its own transaction).
  const gpNumber = await getNextDocumentNumber(DOCUMENT_TYPES.PurchaseGatePass);

  // Step 3 — main transaction.
  return db.transaction(async (tx) => {
    // 3a — verify purchase party exists.
    const partyRows = await tx
      .select({ id: purchasePartiesTable.id })
      .from(purchasePartiesTable)
      .where(eq(purchasePartiesTable.id, input.purchasePartyId));

    if (partyRows.length === 0) {
      throw new PurchasePartyNotFoundError(input.purchasePartyId);
    }

    // 3b — verify all products exist (read-only check, no lock yet).
    for (const item of input.items) {
      const productRows = await tx
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(eq(productsTable.id, item.productId));

      if (productRows.length === 0) {
        throw new PurchaseGatePassProductNotFoundError(item.productId);
      }
    }

    // 3c — insert gate pass header.
    const gatePassInserted = await tx
      .insert(purchaseGatePassesTable)
      .values({
        gpNumber,
        date:            input.date,
        purchasePartyId: input.purchasePartyId,
        lotNumber:       input.lotNumber.trim(),
        remarks:         input.remarks ?? null,
        purchaseBillId:  null,
      })
      .returning();

    const gatePass = gatePassInserted[0]!;

    // 3d + 3e — insert items and post stock.
    const insertedItems: PurchaseGatePassItemRow[] = [];

    for (const item of input.items) {
      const itemInserted = await tx
        .insert(purchaseGatePassItemsTable)
        .values({
          purchaseGatePassId: gatePass.id,
          productId:          item.productId,
          qty:                item.qty != null ? fmtQty(item.qty) : null,
          gazana:             item.gazana != null ? fmtQty(item.gazana) : null,
          rate:               item.rate != null ? fmtMoney(item.rate) : null,
          receivedQty:        item.receivedQty != null ? fmtQty(item.receivedQty) : null,
        })
        .returning();

      insertedItems.push(itemInserted[0]!);

      // 3e — stock IN for received quantity only.
      if (item.receivedQty != null && item.receivedQty > 0) {
        await insertStockIn(tx, {
          productId:   item.productId,
          date:        input.date,
          description: `Purchase Received - ${gpNumber}`,
          refNo:       gpNumber,
          inQty:       item.receivedQty,
        });
      }
    }

    return { gatePass, items: insertedItems };
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Updates an existing Purchase Gate Pass.
 *
 * Rules:
 *   - Blocked if already linked to a Purchase Bill.
 *   - If `items` is supplied, ALL existing items are replaced:
 *       1. For each old item with receivedQty > 0 → compensating OUT entry
 *          (stock reversal).  Old stock ledger rows are NEVER deleted.
 *       2. Old item rows are deleted (cascade from the DB FK is NOT used —
 *          explicit delete keeps the logic clear and auditable).
 *       3. New items are inserted.
 *       4. For each new item with receivedQty > 0 → fresh IN entry.
 *   - If `items` is omitted, only header fields are updated (no stock change).
 *   - The entire operation (reversal + delete + insert + stock) is one transaction.
 *
 * @throws PurchaseGatePassNotFoundError
 * @throws PurchaseGatePassLinkedToBillError
 * @throws PurchaseGatePassProductNotFoundError
 * @throws PurchaseGatePassValidationError
 */
export async function updatePurchaseGatePass(
  id: number,
  input: UpdatePurchaseGatePassInput
): Promise<PurchaseGatePassWithItems> {
  // Pre-validate items if supplied.
  if (input.items !== undefined) {
    validateItems(input.items);
  }

  if (input.date !== undefined && !input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new PurchaseGatePassValidationError(
      "date must be in YYYY-MM-DD format."
    );
  }

  if (input.lotNumber !== undefined && !input.lotNumber.trim()) {
    throw new PurchaseGatePassValidationError("lotNumber cannot be empty.");
  }

  return db.transaction(async (tx) => {
    // Lock the gate pass and verify it's not linked to a bill.
    const { gatePass, items: oldItems } = await fetchLockedGatePass(tx, id);

    // ---- Stock reversal for old items (if items are being replaced) --------
    if (input.items !== undefined) {
      for (const oldItem of oldItems) {
        const oldReceivedQty = parseNum(oldItem.receivedQty);
        if (oldReceivedQty > 0) {
          await insertStockOut(tx, {
            productId:   oldItem.productId,
            date:        gatePass.date,       // use original date for reversal
            description: `Stock Reversal - ${gatePass.gpNumber}`,
            refNo:       gatePass.gpNumber,
            outQty:      oldReceivedQty,
          });
        }
      }

      // Delete all old items explicitly.
      await tx
        .delete(purchaseGatePassItemsTable)
        .where(eq(purchaseGatePassItemsTable.purchaseGatePassId, id));

      // Validate new products exist before inserting.
      for (const item of input.items) {
        const productRows = await tx
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(eq(productsTable.id, item.productId));

        if (productRows.length === 0) {
          throw new PurchaseGatePassProductNotFoundError(item.productId);
        }
      }
    }

    // ---- Update gate pass header -------------------------------------------
    const effectiveDate = input.date ?? gatePass.date;

    const updatedRows = await tx
      .update(purchaseGatePassesTable)
      .set({
        ...(input.date      !== undefined && { date: input.date }),
        ...(input.lotNumber !== undefined && { lotNumber: input.lotNumber.trim() }),
        ...(input.remarks   !== undefined && { remarks: input.remarks }),
        updatedAt: new Date(),
      })
      .where(eq(purchaseGatePassesTable.id, id))
      .returning();

    const updatedGatePass = updatedRows[0]!;

    // ---- Insert new items and post stock -----------------------------------
    let finalItems: PurchaseGatePassItemRow[];

    if (input.items !== undefined) {
      const insertedItems: PurchaseGatePassItemRow[] = [];

      for (const item of input.items) {
        const itemInserted = await tx
          .insert(purchaseGatePassItemsTable)
          .values({
            purchaseGatePassId: id,
            productId:          item.productId,
            qty:                item.qty != null ? fmtQty(item.qty) : null,
            gazana:             item.gazana != null ? fmtQty(item.gazana) : null,
            rate:               item.rate != null ? fmtMoney(item.rate) : null,
            receivedQty:        item.receivedQty != null ? fmtQty(item.receivedQty) : null,
          })
          .returning();

        insertedItems.push(itemInserted[0]!);

        if (item.receivedQty != null && item.receivedQty > 0) {
          await insertStockIn(tx, {
            productId:   item.productId,
            date:        effectiveDate,
            description: `Purchase Received - ${gatePass.gpNumber}`,
            refNo:       gatePass.gpNumber,
            inQty:       item.receivedQty,
          });
        }
      }

      finalItems = insertedItems;
    } else {
      // Items not changed — re-fetch current items unchanged.
      finalItems = await tx
        .select()
        .from(purchaseGatePassItemsTable)
        .where(eq(purchaseGatePassItemsTable.purchaseGatePassId, id))
        .orderBy(asc(purchaseGatePassItemsTable.id));
    }

    return { gatePass: updatedGatePass, items: finalItems };
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Deletes a Purchase Gate Pass and reverses all its stock ledger entries.
 *
 * Steps (all in one transaction):
 *   1. Lock the gate pass — reject if linked to a bill.
 *   2. For each item with receivedQty > 0 → compensating OUT entry (reversal).
 *   3. Delete all items (explicit, not relying on cascade).
 *   4. Delete the gate pass header.
 *
 * Stock ledger history rows are NEVER deleted — only compensating entries are added.
 *
 * @throws PurchaseGatePassNotFoundError
 * @throws PurchaseGatePassLinkedToBillError
 */
export async function deletePurchaseGatePass(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const { gatePass, items } = await fetchLockedGatePass(tx, id);

    // Reverse stock for all items that had received quantities.
    for (const item of items) {
      const oldReceivedQty = parseNum(item.receivedQty);
      if (oldReceivedQty > 0) {
        await insertStockOut(tx, {
          productId:   item.productId,
          date:        gatePass.date,
          description: `Stock Reversal (Deleted) - ${gatePass.gpNumber}`,
          refNo:       gatePass.gpNumber,
          outQty:      oldReceivedQty,
        });
      }
    }

    // Delete items explicitly before deleting the header.
    await tx
      .delete(purchaseGatePassItemsTable)
      .where(eq(purchaseGatePassItemsTable.purchaseGatePassId, id));

    // Delete the gate pass header.
    await tx
      .delete(purchaseGatePassesTable)
      .where(eq(purchaseGatePassesTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

/**
 * Returns a single Purchase Gate Pass with all its items.
 * Returns null if not found (no error).
 */
export async function getPurchaseGatePass(
  id: number
): Promise<PurchaseGatePassWithItems | null> {
  const gatePassRows = await db
    .select()
    .from(purchaseGatePassesTable)
    .where(eq(purchaseGatePassesTable.id, id));

  if (gatePassRows.length === 0) return null;

  const gatePass = gatePassRows[0]!;

  const items = await db
    .select()
    .from(purchaseGatePassItemsTable)
    .where(eq(purchaseGatePassItemsTable.purchaseGatePassId, id))
    .orderBy(asc(purchaseGatePassItemsTable.id));

  return { gatePass, items };
}

/**
 * Returns a Purchase Gate Pass by its document number (e.g. "PGP0001").
 * Returns null if not found.
 */
export async function getPurchaseGatePassByNumber(
  gpNumber: string
): Promise<PurchaseGatePassWithItems | null> {
  const gatePassRows = await db
    .select()
    .from(purchaseGatePassesTable)
    .where(eq(purchaseGatePassesTable.gpNumber, gpNumber));

  if (gatePassRows.length === 0) return null;

  const gatePass = gatePassRows[0]!;

  const items = await db
    .select()
    .from(purchaseGatePassItemsTable)
    .where(eq(purchaseGatePassItemsTable.purchaseGatePassId, gatePass.id))
    .orderBy(asc(purchaseGatePassItemsTable.id));

  return { gatePass, items };
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of Purchase Gate Pass headers.
 *
 * Items are NOT included in list results (fetch them via getPurchaseGatePass
 * when the user opens a specific record).
 *
 * Ordered newest first (descending by date, then by id).
 */
export async function listPurchaseGatePasses(
  input: ListPurchaseGatePassesInput = {}
): Promise<PurchaseGatePassRow[]> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.purchasePartyId !== undefined) {
    conditions.push(
      eq(purchaseGatePassesTable.purchasePartyId, input.purchasePartyId)
    );
  }

  if (input.fromDate !== undefined) {
    conditions.push(gte(purchaseGatePassesTable.date, input.fromDate));
  }

  if (input.toDate !== undefined) {
    conditions.push(lte(purchaseGatePassesTable.date, input.toDate));
  }

  if (input.unlinkedOnly === true) {
    // Gate passes not yet linked to any Purchase Bill.
    conditions.push(
      eq(purchaseGatePassesTable.purchaseBillId, null as unknown as number)
    );
  }

  const query = db
    .select()
    .from(purchaseGatePassesTable)
    .orderBy(
      desc(purchaseGatePassesTable.date),
      desc(purchaseGatePassesTable.id)
    )
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}
