/**
 * Return Gate Pass Service
 *
 * Owns the full lifecycle of Return Gate Passes:
 *   Create → Update → Delete → Get / List
 *
 * Integrations (per approved architecture):
 *   - Number Series Service : generates the RGP document number (own transaction,
 *                             called before the main transaction — gaps on failure
 *                             are acceptable and normal in ERP systems).
 *   - Stock Ledger          : IN entries posted inline within the main transaction
 *                             for Fresh return items only.  B Mall items never
 *                             touch the stock ledger.
 *
 * Scope boundaries (hard rules):
 *   - Never touches financial ledger tables.
 *   - Never touches Return Bill tables directly (only reads returnBillId on header).
 *   - Does not generate any document number other than RGP.
 *   - Update / Delete are blocked when the gate pass is already linked to a bill.
 *   - Stock reversal on Update / Delete is done via compensating OUT entries,
 *     never by deleting existing stock ledger rows.
 *
 * Stock semantics per item:
 *   returnType = 'Fresh'  → stock IN  (customer returns good stock, qty added).
 *   returnType = 'B Mall' → no stock movement (damaged/unsellable goods).
 *   Reversal on update/delete of Fresh items → compensating OUT entries.
 */

import { eq, desc, and, gte, lte, asc, isNull, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  returnGatePassesTable,
  returnGatePassItemsTable,
  salePartiesTable,
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RETURN_TYPE_FRESH  = "Fresh";
const RETURN_TYPE_B_MALL = "B Mall";

// ---------------------------------------------------------------------------
// Public input / output types
// ---------------------------------------------------------------------------

/**
 * A single line item on the return gate pass as supplied by the caller.
 *
 * qty        — quantity being returned.
 * returnType — 'Fresh' (stock IN posted) or 'B Mall' (no stock movement).
 */
export interface ReturnGatePassItemInput {
  productId: number;
  qty?: number | null;
  returnType?: string | null;
}

/** Input for creating a new Return Gate Pass. */
export interface CreateReturnGatePassInput {
  salePartyId: number;
  /** ISO calendar date — "YYYY-MM-DD". */
  date: string;
  remarks?: string | null;
  /** At least one item is required. */
  items: [ReturnGatePassItemInput, ...ReturnGatePassItemInput[]];
}

/**
 * Input for updating an existing Return Gate Pass.
 *
 * Supplying `items` replaces ALL existing items completely.
 * Old Fresh stock is reversed via compensating OUT entries before new stock is posted.
 */
export interface UpdateReturnGatePassInput {
  date?: string;
  remarks?: string | null;
  /** If provided, replaces all items. Must be non-empty when supplied. */
  items?: [ReturnGatePassItemInput, ...ReturnGatePassItemInput[]];
}

/** Filters for listing Return Gate Passes. */
export interface ListReturnGatePassesInput {
  salePartyId?: number;
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?: string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?: string;
  /** true = only gate passes not yet linked to a return bill. */
  unlinkedOnly?: boolean;
  limit?: number;
  offset?: number;
}

/** A return gate pass header row as stored in the database. */
export type ReturnGatePassRow = typeof returnGatePassesTable.$inferSelect;

/** A return gate pass item row as stored in the database. */
export type ReturnGatePassItemRow = typeof returnGatePassItemsTable.$inferSelect;

/** Gate pass header + all its items returned as a single unit. */
export interface ReturnGatePassWithItems {
  gatePass: ReturnGatePassRow;
  items: ReturnGatePassItemRow[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ReturnGatePassNotFoundError extends Error {
  constructor(id: number) {
    super(`Return Gate Pass not found: id=${id}`);
    this.name = "ReturnGatePassNotFoundError";
  }
}

export class ReturnGatePassLinkedToBillError extends Error {
  constructor(id: number, gpNumber: string) {
    super(
      `Return Gate Pass ${gpNumber} (id=${id}) is already linked to a ` +
      "Return Bill and cannot be modified or deleted. " +
      "Unlink the bill first."
    );
    this.name = "ReturnGatePassLinkedToBillError";
  }
}

export class ReturnGatePassPartyNotFoundError extends Error {
  constructor(salePartyId: number) {
    super(`Sale Party not found: id=${salePartyId}`);
    this.name = "ReturnGatePassPartyNotFoundError";
  }
}

export class ReturnGatePassProductNotFoundError extends Error {
  constructor(productId: number) {
    super(`Product not found: id=${productId} (referenced in return gate pass items)`);
    this.name = "ReturnGatePassProductNotFoundError";
  }
}

export class ReturnGatePassValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReturnGatePassValidationError";
  }
}

// ---------------------------------------------------------------------------
// Internal numeric helpers
// ---------------------------------------------------------------------------

/** Formats a JS number to 3-decimal string for numeric(10,3) columns. */
function fmtQty(v: number): string {
  return v.toFixed(3);
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

function validateItems(items: ReturnGatePassItemInput[]): void {
  if (items.length === 0) {
    throw new ReturnGatePassValidationError(
      "At least one item is required on a Return Gate Pass."
    );
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!Number.isInteger(item.productId) || item.productId <= 0) {
      throw new ReturnGatePassValidationError(
        `Item[${i}]: productId must be a positive integer.`
      );
    }
    if (item.qty != null && (item.qty <= 0 || !isFinite(item.qty))) {
      throw new ReturnGatePassValidationError(
        `Item[${i}]: qty must be a positive finite number when provided.`
      );
    }
    if (
      item.returnType != null &&
      item.returnType !== RETURN_TYPE_FRESH &&
      item.returnType !== RETURN_TYPE_B_MALL
    ) {
      throw new ReturnGatePassValidationError(
        `Item[${i}]: returnType must be 'Fresh' or 'B Mall' when provided.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped stock ledger helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a product exists and acquires an exclusive row lock on it.
 * Serialises concurrent stock writes for the same product within the tx.
 *
 * @throws ReturnGatePassProductNotFoundError if productId not found.
 */
async function lockProductForStock(tx: Tx, productId: number): Promise<void> {
  const rows = await tx
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .for("update");

  if (rows.length === 0) {
    throw new ReturnGatePassProductNotFoundError(productId);
  }
}

/**
 * Reads the most recent stock balance for a product.
 * Must only be called after lockProductForStock() for the same productId within the tx.
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

/**
 * Inserts a stock IN entry within an existing transaction.
 * Used for Fresh return items: goods returned to stock.
 */
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
 * Used to reverse a previously posted Fresh IN quantity (on Update or Delete).
 * Stock ledger history rows are NEVER deleted.
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
 * Rejects if the gate pass is already linked to a Return Bill.
 *
 * @throws ReturnGatePassNotFoundError
 * @throws ReturnGatePassLinkedToBillError
 */
async function fetchLockedGatePass(
  tx: Tx,
  id: number
): Promise<{ gatePass: ReturnGatePassRow; items: ReturnGatePassItemRow[] }> {
  const gatePassRows = await tx
    .select()
    .from(returnGatePassesTable)
    .where(eq(returnGatePassesTable.id, id))
    .for("update");

  if (gatePassRows.length === 0) {
    throw new ReturnGatePassNotFoundError(id);
  }

  const gatePass = gatePassRows[0]!;

  if (gatePass.returnBillId !== null) {
    throw new ReturnGatePassLinkedToBillError(id, gatePass.gpNumber);
  }

  const items = await tx
    .select()
    .from(returnGatePassItemsTable)
    .where(eq(returnGatePassItemsTable.returnGatePassId, id))
    .orderBy(asc(returnGatePassItemsTable.id));

  return { gatePass, items };
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Return Gate Pass with all its items.
 *
 * Steps (all atomic except number generation):
 *   1. Validate inputs (before any I/O).
 *   2. Generate the next RGP document number (own committed transaction).
 *   3. Open the main transaction:
 *      a. Verify the sale party exists.
 *      b. Verify all product IDs exist (read-only check).
 *      c. Insert the gate pass header.
 *      d. For each item: insert row + post stock IN if returnType='Fresh' and qty > 0.
 *         B Mall items: row inserted but no stock movement.
 *   4. Return the saved gate pass with items.
 *
 * @throws ReturnGatePassValidationError
 * @throws ReturnGatePassPartyNotFoundError
 * @throws ReturnGatePassProductNotFoundError
 */
export async function createReturnGatePass(
  input: CreateReturnGatePassInput
): Promise<ReturnGatePassWithItems> {
  // Step 1 — validate before any I/O.
  validateItems(input.items);

  if (!input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new ReturnGatePassValidationError("date must be in YYYY-MM-DD format.");
  }

  // Step 2 — generate document number (commits its own transaction).
  const gpNumber = await getNextDocumentNumber(DOCUMENT_TYPES.ReturnGatePass);

  // Step 3 — main transaction.
  return db.transaction(async (tx) => {
    // 3a — verify sale party exists.
    const partyRows = await tx
      .select({ id: salePartiesTable.id })
      .from(salePartiesTable)
      .where(eq(salePartiesTable.id, input.salePartyId));

    if (partyRows.length === 0) {
      throw new ReturnGatePassPartyNotFoundError(input.salePartyId);
    }

    // 3b — verify all products exist (read-only check; lock happens in insertStockIn).
    for (const item of input.items) {
      const productRows = await tx
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(eq(productsTable.id, item.productId));

      if (productRows.length === 0) {
        throw new ReturnGatePassProductNotFoundError(item.productId);
      }
    }

    // 3c — insert gate pass header.
    const gatePassInserted = await tx
      .insert(returnGatePassesTable)
      .values({
        gpNumber,
        date:         input.date,
        salePartyId:  input.salePartyId,
        remarks:      input.remarks ?? null,
        returnBillId: null,
      })
      .returning();

    const gatePass = gatePassInserted[0]!;

    // 3d — insert items and post stock for Fresh returns.
    const insertedItems: ReturnGatePassItemRow[] = [];

    for (const item of input.items) {
      const itemInserted = await tx
        .insert(returnGatePassItemsTable)
        .values({
          returnGatePassId: gatePass.id,
          productId:        item.productId,
          qty:              item.qty != null ? fmtQty(item.qty) : null,
          returnType:       item.returnType ?? null,
        })
        .returning();

      insertedItems.push(itemInserted[0]!);

      // Stock IN only for Fresh returns with a positive quantity.
      if (
        item.returnType === RETURN_TYPE_FRESH &&
        item.qty != null &&
        item.qty > 0
      ) {
        await insertStockIn(tx, {
          productId:   item.productId,
          date:        input.date,
          description: `Return Received (Fresh) - ${gpNumber}`,
          refNo:       gpNumber,
          inQty:       item.qty,
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
 * Updates an existing Return Gate Pass.
 *
 * Rules:
 *   - Blocked if already linked to a Return Bill.
 *   - If `items` is supplied, ALL existing items are replaced:
 *       1. For each old Fresh item with qty > 0 → compensating OUT entry (reversal).
 *          B Mall items had no stock movement, so nothing to reverse.
 *       2. Old item rows deleted explicitly.
 *       3. New items inserted.
 *       4. For each new Fresh item with qty > 0 → fresh IN entry.
 *   - If `items` is omitted, only header fields are updated (no stock change).
 *
 * @throws ReturnGatePassNotFoundError
 * @throws ReturnGatePassLinkedToBillError
 * @throws ReturnGatePassProductNotFoundError
 * @throws ReturnGatePassValidationError
 */
export async function updateReturnGatePass(
  id: number,
  input: UpdateReturnGatePassInput
): Promise<ReturnGatePassWithItems> {
  if (input.items !== undefined) {
    validateItems(input.items);
  }

  if (input.date !== undefined && !input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new ReturnGatePassValidationError("date must be in YYYY-MM-DD format.");
  }

  return db.transaction(async (tx) => {
    const { gatePass, items: oldItems } = await fetchLockedGatePass(tx, id);

    // ---- Stock reversal for old Fresh items (only when items are being replaced) --
    if (input.items !== undefined) {
      for (const oldItem of oldItems) {
        const oldQty = parseNum(oldItem.qty);
        if (oldItem.returnType === RETURN_TYPE_FRESH && oldQty > 0) {
          await insertStockOut(tx, {
            productId:   oldItem.productId,
            date:        gatePass.date,
            description: `Stock Reversal - ${gatePass.gpNumber}`,
            refNo:       gatePass.gpNumber,
            outQty:      oldQty,
          });
        }
        // B Mall items: no reversal needed (no stock was posted).
      }

      // Delete all old items explicitly.
      await tx
        .delete(returnGatePassItemsTable)
        .where(eq(returnGatePassItemsTable.returnGatePassId, id));

      // Validate new products exist before inserting.
      for (const item of input.items) {
        const productRows = await tx
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(eq(productsTable.id, item.productId));

        if (productRows.length === 0) {
          throw new ReturnGatePassProductNotFoundError(item.productId);
        }
      }
    }

    // ---- Update gate pass header -------------------------------------------
    const effectiveDate = input.date ?? gatePass.date;

    const updatedRows = await tx
      .update(returnGatePassesTable)
      .set({
        ...(input.date    !== undefined && { date:    input.date }),
        ...(input.remarks !== undefined && { remarks: input.remarks }),
        updatedAt: new Date(),
      })
      .where(eq(returnGatePassesTable.id, id))
      .returning();

    const updatedGatePass = updatedRows[0]!;

    // ---- Insert new items and post stock for Fresh returns -----------------
    let finalItems: ReturnGatePassItemRow[];

    if (input.items !== undefined) {
      const insertedItems: ReturnGatePassItemRow[] = [];

      for (const item of input.items) {
        const itemInserted = await tx
          .insert(returnGatePassItemsTable)
          .values({
            returnGatePassId: id,
            productId:        item.productId,
            qty:              item.qty != null ? fmtQty(item.qty) : null,
            returnType:       item.returnType ?? null,
          })
          .returning();

        insertedItems.push(itemInserted[0]!);

        if (
          item.returnType === RETURN_TYPE_FRESH &&
          item.qty != null &&
          item.qty > 0
        ) {
          await insertStockIn(tx, {
            productId:   item.productId,
            date:        effectiveDate,
            description: `Return Received (Fresh) - ${gatePass.gpNumber}`,
            refNo:       gatePass.gpNumber,
            inQty:       item.qty,
          });
        }
      }

      finalItems = insertedItems;
    } else {
      // Items not changed — re-fetch current items unchanged.
      finalItems = await tx
        .select()
        .from(returnGatePassItemsTable)
        .where(eq(returnGatePassItemsTable.returnGatePassId, id))
        .orderBy(asc(returnGatePassItemsTable.id));
    }

    return { gatePass: updatedGatePass, items: finalItems };
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Deletes a Return Gate Pass and reverses all Fresh stock ledger entries.
 *
 * Steps (all in one transaction):
 *   1. Lock the gate pass — reject if linked to a Return Bill.
 *   2. For each Fresh item with qty > 0 → compensating OUT entry (reversal).
 *      B Mall items: no reversal (nothing was posted).
 *   3. Delete all items (explicit, not relying on cascade).
 *   4. Delete the gate pass header.
 *
 * Stock ledger history rows are NEVER deleted — only compensating OUT entries added.
 *
 * @throws ReturnGatePassNotFoundError
 * @throws ReturnGatePassLinkedToBillError
 */
export async function deleteReturnGatePass(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const { gatePass, items } = await fetchLockedGatePass(tx, id);

    // Reverse stock only for Fresh items that had positive quantities.
    for (const item of items) {
      const oldQty = parseNum(item.qty);
      if (item.returnType === RETURN_TYPE_FRESH && oldQty > 0) {
        await insertStockOut(tx, {
          productId:   item.productId,
          date:        gatePass.date,
          description: `Stock Reversal (Deleted) - ${gatePass.gpNumber}`,
          refNo:       gatePass.gpNumber,
          outQty:      oldQty,
        });
      }
    }

    // Delete items explicitly before deleting the header.
    await tx
      .delete(returnGatePassItemsTable)
      .where(eq(returnGatePassItemsTable.returnGatePassId, id));

    // Delete the gate pass header.
    await tx
      .delete(returnGatePassesTable)
      .where(eq(returnGatePassesTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

/**
 * Returns a single Return Gate Pass with all its items.
 * Returns null if not found (no error thrown).
 */
export async function getReturnGatePass(
  id: number
): Promise<ReturnGatePassWithItems | null> {
  const gatePassRows = await db
    .select()
    .from(returnGatePassesTable)
    .where(eq(returnGatePassesTable.id, id));

  if (gatePassRows.length === 0) return null;

  const gatePass = gatePassRows[0]!;

  const items = await db
    .select()
    .from(returnGatePassItemsTable)
    .where(eq(returnGatePassItemsTable.returnGatePassId, id))
    .orderBy(asc(returnGatePassItemsTable.id));

  return { gatePass, items };
}

/**
 * Returns a Return Gate Pass by its document number (e.g. "RGP0001").
 * Returns null if not found.
 */
export async function getReturnGatePassByNumber(
  gpNumber: string
): Promise<ReturnGatePassWithItems | null> {
  const gatePassRows = await db
    .select()
    .from(returnGatePassesTable)
    .where(eq(returnGatePassesTable.gpNumber, gpNumber));

  if (gatePassRows.length === 0) return null;

  const gatePass = gatePassRows[0]!;

  const items = await db
    .select()
    .from(returnGatePassItemsTable)
    .where(eq(returnGatePassItemsTable.returnGatePassId, gatePass.id))
    .orderBy(asc(returnGatePassItemsTable.id));

  return { gatePass, items };
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of Return Gate Pass headers.
 *
 * Items are NOT included in list results — use getReturnGatePass() to load
 * the full record when the user opens a specific entry.
 *
 * Ordered newest first (descending by date, then by id).
 */
export async function listReturnGatePasses(
  input: ListReturnGatePassesInput = {}
): Promise<{ rows: ReturnGatePassRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.salePartyId !== undefined) {
    conditions.push(eq(returnGatePassesTable.salePartyId, input.salePartyId));
  }
  if (input.fromDate !== undefined) {
    conditions.push(gte(returnGatePassesTable.date, input.fromDate));
  }
  if (input.toDate !== undefined) {
    conditions.push(lte(returnGatePassesTable.date, input.toDate));
  }
  if (input.unlinkedOnly === true) {
    conditions.push(isNull(returnGatePassesTable.returnBillId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(returnGatePassesTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),
    db
      .select()
      .from(returnGatePassesTable)
      .where(where)
      .orderBy(desc(returnGatePassesTable.date), desc(returnGatePassesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
