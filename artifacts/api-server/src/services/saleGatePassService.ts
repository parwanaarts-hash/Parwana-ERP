/**
 * Sale Gate Pass Service
 *
 * Owns the full lifecycle of Sale Gate Passes:
 *   Create → Update → Delete → Get / List
 *
 * Integrations (per approved architecture):
 *   - Number Series Service  : generates the SGP document number (own transaction,
 *                              called before the main transaction — gaps on failure
 *                              are acceptable and normal in ERP systems).
 *   - Stock Ledger           : OUT entries created inline within the main transaction
 *                              using tx-scoped helpers.  This guarantees that the
 *                              header, items, and every stock movement commit or
 *                              rollback together as a single atomic unit.
 *
 * Scope boundaries (hard rules):
 *   - Never touches financial ledger tables.
 *   - Never touches Sales Bill tables directly (only reads salesBillId on gate pass).
 *   - Does not generate any document number other than SGP.
 *   - Update / Delete are blocked when the gate pass is already linked to a bill.
 *   - Stock reversal on Update / Delete is done via compensating IN entries,
 *     never by deleting existing stock ledger rows.
 *
 * Stock semantics:
 *   Sale Gate Pass CREATE → stock OUT (items dispatched out of warehouse).
 *   Sale Gate Pass UPDATE → IN reversal of old qty + fresh OUT for new qty.
 *   Sale Gate Pass DELETE → IN reversal of dispatched qty.
 */

import { eq, desc, and, gte, lte, asc, isNull, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  saleGatePassesTable,
  saleGatePassItemsTable,
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
// Public input / output types
// ---------------------------------------------------------------------------

/**
 * A single line item on the sale gate pass as supplied by the caller.
 *
 * qty       — quantity dispatched from the warehouse (drives stock OUT).
 * gazana    — per-piece Guz measurement for Than-type products.
 * rate      — base rate per unit.
 * finalRate — negotiated/agreed final rate for the line.
 * total     — line item total (qty × finalRate, or entered directly).
 */
export interface SaleGatePassItemInput {
  productId: number;
  qty?: number | null;
  gazana?: number | null;
  rate?: number | null;
  finalRate?: number | null;
  total?: number | null;
}

/** Input for creating a new Sale Gate Pass. */
export interface CreateSaleGatePassInput {
  salePartyId: number;
  /** ISO calendar date — "YYYY-MM-DD". */
  date: string;
  remarks?: string | null;
  /** At least one item is required. */
  items: [SaleGatePassItemInput, ...SaleGatePassItemInput[]];
}

/**
 * Input for updating an existing Sale Gate Pass.
 *
 * Supplying `items` replaces ALL existing items completely.
 * Old stock OUT is reversed via compensating IN entries before new OUT is posted.
 */
export interface UpdateSaleGatePassInput {
  date?: string;
  remarks?: string | null;
  /** If provided, replaces all items. Must be non-empty when supplied. */
  items?: [SaleGatePassItemInput, ...SaleGatePassItemInput[]];
}

/** Filters for listing Sale Gate Passes. */
export interface ListSaleGatePassesInput {
  salePartyId?: number;
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?: string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?: string;
  /** true = only gate passes not yet linked to a sales bill. */
  unlinkedOnly?: boolean;
  limit?: number;
  offset?: number;
}

/** A gate pass header row as stored in the database. */
export type SaleGatePassRow = typeof saleGatePassesTable.$inferSelect;

/** A gate pass item row as stored in the database. */
export type SaleGatePassItemRow = typeof saleGatePassItemsTable.$inferSelect;

/** Gate pass header + all its items returned as a single unit. */
export interface SaleGatePassWithItems {
  gatePass: SaleGatePassRow;
  items: SaleGatePassItemRow[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SaleGatePassNotFoundError extends Error {
  constructor(id: number) {
    super(`Sale Gate Pass not found: id=${id}`);
    this.name = "SaleGatePassNotFoundError";
  }
}

export class SaleGatePassLinkedToBillError extends Error {
  constructor(id: number, gpNumber: string) {
    super(
      `Sale Gate Pass ${gpNumber} (id=${id}) is already linked to a ` +
      "Sales Bill and cannot be modified or deleted. " +
      "Unlink the bill first."
    );
    this.name = "SaleGatePassLinkedToBillError";
  }
}

export class SalePartyNotFoundError extends Error {
  constructor(salePartyId: number) {
    super(`Sale Party not found: id=${salePartyId}`);
    this.name = "SalePartyNotFoundError";
  }
}

export class SaleGatePassProductNotFoundError extends Error {
  constructor(productId: number) {
    super(`Product not found: id=${productId} (referenced in gate pass items)`);
    this.name = "SaleGatePassProductNotFoundError";
  }
}

export class SaleGatePassValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleGatePassValidationError";
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

function validateItems(items: SaleGatePassItemInput[]): void {
  if (items.length === 0) {
    throw new SaleGatePassValidationError(
      "At least one item is required on a Sale Gate Pass."
    );
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!Number.isInteger(item.productId) || item.productId <= 0) {
      throw new SaleGatePassValidationError(
        `Item[${i}]: productId must be a positive integer.`
      );
    }
    if (item.qty != null && (item.qty <= 0 || !isFinite(item.qty))) {
      throw new SaleGatePassValidationError(
        `Item[${i}]: qty must be a positive finite number when provided.`
      );
    }
    if (item.gazana != null && (item.gazana <= 0 || !isFinite(item.gazana))) {
      throw new SaleGatePassValidationError(
        `Item[${i}]: gazana must be a positive finite number when provided.`
      );
    }
    if (item.rate != null && (item.rate <= 0 || !isFinite(item.rate))) {
      throw new SaleGatePassValidationError(
        `Item[${i}]: rate must be a positive finite number when provided.`
      );
    }
    if (item.finalRate != null && (item.finalRate <= 0 || !isFinite(item.finalRate))) {
      throw new SaleGatePassValidationError(
        `Item[${i}]: finalRate must be a positive finite number when provided.`
      );
    }
    if (item.total != null && (!isFinite(item.total) || item.total < 0)) {
      throw new SaleGatePassValidationError(
        `Item[${i}]: total must be a non-negative finite number when provided.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Transaction-scoped stock ledger helpers
//
// Accept the outer `tx` so that stock writes are part of the same atomic
// transaction as the gate pass header and items.
// ---------------------------------------------------------------------------

/**
 * Validates that a product exists and acquires an exclusive row lock on it.
 * Serialises concurrent stock writes for the same product within the tx.
 *
 * @throws SaleGatePassProductNotFoundError if productId not found.
 */
async function lockProductForStock(tx: Tx, productId: number): Promise<void> {
  const rows = await tx
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .for("update");

  if (rows.length === 0) {
    throw new SaleGatePassProductNotFoundError(productId);
  }
}

/**
 * Reads the most recent stock balance for a product.
 * Must be called after lockProductForStock() for the same productId within the tx.
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
 * Inserts a stock OUT entry within an existing transaction.
 * Used on create: items are being dispatched from the warehouse.
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

/**
 * Inserts a compensating stock IN entry within an existing transaction.
 * Used to reverse a previously posted OUT quantity (on Update or Delete).
 * Stock ledger history rows are NEVER deleted — this IN is additive.
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

// ---------------------------------------------------------------------------
// Shared: fetch gate pass with items inside a transaction (with row lock)
// ---------------------------------------------------------------------------

/**
 * Fetches the gate pass header (with FOR UPDATE lock) and its items.
 * Rejects if the gate pass is already linked to a Sales Bill.
 *
 * @throws SaleGatePassNotFoundError
 * @throws SaleGatePassLinkedToBillError
 */
async function fetchLockedGatePass(
  tx: Tx,
  id: number
): Promise<{ gatePass: SaleGatePassRow; items: SaleGatePassItemRow[] }> {
  const gatePassRows = await tx
    .select()
    .from(saleGatePassesTable)
    .where(eq(saleGatePassesTable.id, id))
    .for("update");

  if (gatePassRows.length === 0) {
    throw new SaleGatePassNotFoundError(id);
  }

  const gatePass = gatePassRows[0]!;

  if (gatePass.salesBillId !== null) {
    throw new SaleGatePassLinkedToBillError(id, gatePass.gpNumber);
  }

  const items = await tx
    .select()
    .from(saleGatePassItemsTable)
    .where(eq(saleGatePassItemsTable.saleGatePassId, id))
    .orderBy(asc(saleGatePassItemsTable.id));

  return { gatePass, items };
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Sale Gate Pass with all its items.
 *
 * Steps (all atomic except number generation):
 *   1. Validate inputs (before any I/O).
 *   2. Generate the next SGP document number (own committed transaction).
 *   3. Open the main transaction:
 *      a. Verify the sale party exists.
 *      b. Verify all product IDs exist.
 *      c. Insert the gate pass header.
 *      d. For each item: insert row + post stock OUT if qty > 0.
 *   4. Return the saved gate pass with items.
 *
 * @throws SaleGatePassValidationError
 * @throws SalePartyNotFoundError
 * @throws SaleGatePassProductNotFoundError
 */
export async function createSaleGatePass(
  input: CreateSaleGatePassInput
): Promise<SaleGatePassWithItems> {
  // Step 1 — validate before any I/O.
  validateItems(input.items);

  if (!input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new SaleGatePassValidationError("date must be in YYYY-MM-DD format.");
  }

  // Step 2 — generate document number (commits its own transaction).
  const gpNumber = await getNextDocumentNumber(DOCUMENT_TYPES.SaleGatePass);

  // Step 3 — main transaction.
  return db.transaction(async (tx) => {
    // 3a — verify sale party exists.
    const partyRows = await tx
      .select({ id: salePartiesTable.id })
      .from(salePartiesTable)
      .where(eq(salePartiesTable.id, input.salePartyId));

    if (partyRows.length === 0) {
      throw new SalePartyNotFoundError(input.salePartyId);
    }

    // 3b — verify all products exist (read-only check, lock happens in insertStockOut).
    for (const item of input.items) {
      const productRows = await tx
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(eq(productsTable.id, item.productId));

      if (productRows.length === 0) {
        throw new SaleGatePassProductNotFoundError(item.productId);
      }
    }

    // 3c — insert gate pass header.
    const gatePassInserted = await tx
      .insert(saleGatePassesTable)
      .values({
        gpNumber,
        date:        input.date,
        salePartyId: input.salePartyId,
        remarks:     input.remarks ?? null,
        salesBillId: null,
      })
      .returning();

    const gatePass = gatePassInserted[0]!;

    // 3d — insert items and post stock OUT.
    const insertedItems: SaleGatePassItemRow[] = [];

    for (const item of input.items) {
      const itemInserted = await tx
        .insert(saleGatePassItemsTable)
        .values({
          saleGatePassId: gatePass.id,
          productId:      item.productId,
          qty:            item.qty       != null ? fmtQty(item.qty)           : null,
          gazana:         item.gazana    != null ? fmtQty(item.gazana)         : null,
          rate:           item.rate      != null ? fmtMoney(item.rate)         : null,
          finalRate:      item.finalRate != null ? fmtMoney(item.finalRate)    : null,
          total:          item.total     != null ? fmtMoney(item.total)        : null,
        })
        .returning();

      insertedItems.push(itemInserted[0]!);

      // Stock OUT for dispatched quantity.
      if (item.qty != null && item.qty > 0) {
        await insertStockOut(tx, {
          productId:   item.productId,
          date:        input.date,
          description: `Sale Dispatched - ${gpNumber}`,
          refNo:       gpNumber,
          outQty:      item.qty,
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
 * Updates an existing Sale Gate Pass.
 *
 * Rules:
 *   - Blocked if already linked to a Sales Bill.
 *   - If `items` is supplied, ALL existing items are replaced:
 *       1. For each old item with qty > 0 → compensating IN entry (stock reversal).
 *       2. Old item rows are deleted explicitly.
 *       3. New items are inserted.
 *       4. For each new item with qty > 0 → fresh OUT entry.
 *   - If `items` is omitted, only header fields are updated (no stock change).
 *
 * @throws SaleGatePassNotFoundError
 * @throws SaleGatePassLinkedToBillError
 * @throws SaleGatePassProductNotFoundError
 * @throws SaleGatePassValidationError
 */
export async function updateSaleGatePass(
  id: number,
  input: UpdateSaleGatePassInput
): Promise<SaleGatePassWithItems> {
  if (input.items !== undefined) {
    validateItems(input.items);
  }

  if (input.date !== undefined && !input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new SaleGatePassValidationError("date must be in YYYY-MM-DD format.");
  }

  return db.transaction(async (tx) => {
    const { gatePass, items: oldItems } = await fetchLockedGatePass(tx, id);

    // ---- Stock reversal for old items (only when items are being replaced) --
    if (input.items !== undefined) {
      for (const oldItem of oldItems) {
        const oldQty = parseNum(oldItem.qty);
        if (oldQty > 0) {
          await insertStockIn(tx, {
            productId:   oldItem.productId,
            date:        gatePass.date,
            description: `Stock Reversal - ${gatePass.gpNumber}`,
            refNo:       gatePass.gpNumber,
            inQty:       oldQty,
          });
        }
      }

      // Delete all old items explicitly.
      await tx
        .delete(saleGatePassItemsTable)
        .where(eq(saleGatePassItemsTable.saleGatePassId, id));

      // Validate new products exist before inserting.
      for (const item of input.items) {
        const productRows = await tx
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(eq(productsTable.id, item.productId));

        if (productRows.length === 0) {
          throw new SaleGatePassProductNotFoundError(item.productId);
        }
      }
    }

    // ---- Update gate pass header -------------------------------------------
    const effectiveDate = input.date ?? gatePass.date;

    const updatedRows = await tx
      .update(saleGatePassesTable)
      .set({
        ...(input.date    !== undefined && { date: input.date }),
        ...(input.remarks !== undefined && { remarks: input.remarks }),
        updatedAt: new Date(),
      })
      .where(eq(saleGatePassesTable.id, id))
      .returning();

    const updatedGatePass = updatedRows[0]!;

    // ---- Insert new items and post stock OUT --------------------------------
    let finalItems: SaleGatePassItemRow[];

    if (input.items !== undefined) {
      const insertedItems: SaleGatePassItemRow[] = [];

      for (const item of input.items) {
        const itemInserted = await tx
          .insert(saleGatePassItemsTable)
          .values({
            saleGatePassId: id,
            productId:      item.productId,
            qty:            item.qty       != null ? fmtQty(item.qty)        : null,
            gazana:         item.gazana    != null ? fmtQty(item.gazana)      : null,
            rate:           item.rate      != null ? fmtMoney(item.rate)      : null,
            finalRate:      item.finalRate != null ? fmtMoney(item.finalRate) : null,
            total:          item.total     != null ? fmtMoney(item.total)     : null,
          })
          .returning();

        insertedItems.push(itemInserted[0]!);

        if (item.qty != null && item.qty > 0) {
          await insertStockOut(tx, {
            productId:   item.productId,
            date:        effectiveDate,
            description: `Sale Dispatched - ${gatePass.gpNumber}`,
            refNo:       gatePass.gpNumber,
            outQty:      item.qty,
          });
        }
      }

      finalItems = insertedItems;
    } else {
      // Items not changed — re-fetch current items unchanged.
      finalItems = await tx
        .select()
        .from(saleGatePassItemsTable)
        .where(eq(saleGatePassItemsTable.saleGatePassId, id))
        .orderBy(asc(saleGatePassItemsTable.id));
    }

    return { gatePass: updatedGatePass, items: finalItems };
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Deletes a Sale Gate Pass and reverses all its stock ledger entries.
 *
 * Steps (all in one transaction):
 *   1. Lock the gate pass — reject if linked to a Sales Bill.
 *   2. For each item with qty > 0 → compensating IN entry (reversal).
 *   3. Delete all items (explicit, not relying on cascade).
 *   4. Delete the gate pass header.
 *
 * Stock ledger history rows are NEVER deleted — only compensating IN entries are added.
 *
 * @throws SaleGatePassNotFoundError
 * @throws SaleGatePassLinkedToBillError
 */
export async function deleteSaleGatePass(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const { gatePass, items } = await fetchLockedGatePass(tx, id);

    // Reverse stock for all items that had quantities dispatched.
    for (const item of items) {
      const oldQty = parseNum(item.qty);
      if (oldQty > 0) {
        await insertStockIn(tx, {
          productId:   item.productId,
          date:        gatePass.date,
          description: `Stock Reversal (Deleted) - ${gatePass.gpNumber}`,
          refNo:       gatePass.gpNumber,
          inQty:       oldQty,
        });
      }
    }

    // Delete items explicitly before deleting the header.
    await tx
      .delete(saleGatePassItemsTable)
      .where(eq(saleGatePassItemsTable.saleGatePassId, id));

    // Delete the gate pass header.
    await tx
      .delete(saleGatePassesTable)
      .where(eq(saleGatePassesTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

/**
 * Returns a single Sale Gate Pass with all its items.
 * Returns null if not found (no error thrown).
 */
export async function getSaleGatePass(
  id: number
): Promise<SaleGatePassWithItems | null> {
  const gatePassRows = await db
    .select()
    .from(saleGatePassesTable)
    .where(eq(saleGatePassesTable.id, id));

  if (gatePassRows.length === 0) return null;

  const gatePass = gatePassRows[0]!;

  const items = await db
    .select()
    .from(saleGatePassItemsTable)
    .where(eq(saleGatePassItemsTable.saleGatePassId, id))
    .orderBy(asc(saleGatePassItemsTable.id));

  return { gatePass, items };
}

/**
 * Returns a Sale Gate Pass by its document number (e.g. "SGP0001").
 * Returns null if not found.
 */
export async function getSaleGatePassByNumber(
  gpNumber: string
): Promise<SaleGatePassWithItems | null> {
  const gatePassRows = await db
    .select()
    .from(saleGatePassesTable)
    .where(eq(saleGatePassesTable.gpNumber, gpNumber));

  if (gatePassRows.length === 0) return null;

  const gatePass = gatePassRows[0]!;

  const items = await db
    .select()
    .from(saleGatePassItemsTable)
    .where(eq(saleGatePassItemsTable.saleGatePassId, gatePass.id))
    .orderBy(asc(saleGatePassItemsTable.id));

  return { gatePass, items };
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of Sale Gate Pass headers.
 *
 * Items are NOT included in list results — use getSaleGatePass() to load
 * the full record when the user opens a specific entry.
 *
 * Ordered newest first (descending by date, then by id).
 */
export async function listSaleGatePasses(
  input: ListSaleGatePassesInput = {}
): Promise<{ rows: SaleGatePassRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.salePartyId !== undefined) {
    conditions.push(eq(saleGatePassesTable.salePartyId, input.salePartyId));
  }
  if (input.fromDate !== undefined) {
    conditions.push(gte(saleGatePassesTable.date, input.fromDate));
  }
  if (input.toDate !== undefined) {
    conditions.push(lte(saleGatePassesTable.date, input.toDate));
  }
  if (input.unlinkedOnly === true) {
    // Must use isNull() — SQL `= NULL` never matches; only `IS NULL` does.
    conditions.push(isNull(saleGatePassesTable.salesBillId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(saleGatePassesTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),
    db
      .select()
      .from(saleGatePassesTable)
      .where(where)
      .orderBy(desc(saleGatePassesTable.date), desc(saleGatePassesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
