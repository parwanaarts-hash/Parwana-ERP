/**
 * Stock Ledger Service
 *
 * Responsible exclusively for stock_ledger_entries.
 * Creates IN / OUT entries and maintains the running per-product balance.
 *
 * Scope boundaries (hard rules):
 *   - Never reads or writes any financial ledger table.
 *   - Never generates document numbers (caller supplies ref_no).
 *   - Never enforces Purchase / Sale / Return business workflow rules.
 *   - Does not implement edit / delete balance-recalculation.
 */

import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { stockLedgerEntriesTable, productsTable } from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Input for a stock IN entry (goods received into warehouse). */
export interface AddStockInParams {
  productId: number;
  /** ISO calendar date string — "YYYY-MM-DD". */
  date: string;
  /** Human-readable description, e.g. "Purchase Received - PGP0001". */
  description: string;
  /** Reference document number that triggered this movement. Nullable for opening balances. */
  refNo?: string;
  /** Quantity received. Must be > 0. numeric(10,3) precision. */
  inQty: number;
}

/** Input for a stock OUT entry (goods dispatched from warehouse). */
export interface AddStockOutParams {
  productId: number;
  /** ISO calendar date string — "YYYY-MM-DD". */
  date: string;
  /** Human-readable description, e.g. "Sale Dispatched - SGP0001". */
  description: string;
  /** Reference document number that triggered this movement. */
  refNo?: string;
  /** Quantity dispatched. Must be > 0. numeric(10,3) precision. */
  outQty: number;
}

/** Filters for querying a product's ledger history. */
export interface GetProductLedgerParams {
  productId: number;
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?: string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?: string;
  /** Maximum rows to return (default: 100). */
  limit?: number;
  /** Rows to skip for pagination (default: 0). */
  offset?: number;
}

/**
 * A single stock ledger row as returned by query operations.
 * Numeric columns (inQty, outQty, balance) are returned as strings by the
 * PostgreSQL driver — callers should use parseQty() if arithmetic is needed.
 */
export type StockLedgerRow = typeof stockLedgerEntriesTable.$inferSelect;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when a productId has no matching row in the products table. */
export class StockProductNotFoundError extends Error {
  constructor(productId: number) {
    super(`Product not found: id=${productId}`);
    this.name = "StockProductNotFoundError";
  }
}

/** Thrown when a quantity argument is not a positive finite number. */
export class StockInvalidQuantityError extends Error {
  constructor(value: number, field: string) {
    super(`${field} must be a positive finite number; received ${value}`);
    this.name = "StockInvalidQuantityError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses the string representation of a PostgreSQL numeric column into a
 * JavaScript number.  Safe for numeric(10,3) — maximum 10 significant digits
 * is well within JavaScript's 15-digit float precision.
 */
function parseQty(value: string | null | undefined): number {
  if (value == null) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

/**
 * Formats a JavaScript number to a fixed-3-decimal string for database writes.
 * Drizzle accepts string values for numeric columns.
 */
function formatQty(value: number): string {
  return value.toFixed(3);
}

/**
 * Guards that a quantity argument is positive and finite.
 * @throws StockInvalidQuantityError
 */
function assertPositiveQty(value: number, field: string): void {
  if (!isFinite(value) || value <= 0) {
    throw new StockInvalidQuantityError(value, field);
  }
}

// ---------------------------------------------------------------------------
// Atomicity helper
// ---------------------------------------------------------------------------

/**
 * Fetches the current running balance for a product inside an open transaction
 * and acquires an exclusive lock that prevents concurrent inserts from using
 * a stale balance.
 *
 * Locking strategy:
 *   1. Lock the products row (FOR UPDATE) — gives a stable, always-present
 *      anchor for any product regardless of how many ledger rows exist.
 *      This serialises ALL concurrent stock writes for the same product,
 *      including the very first insert when no ledger rows exist yet.
 *   2. Read the most recent ledger row's balance (no additional lock needed —
 *      step 1 already blocks concurrent writers for this product).
 *
 * @returns Current balance as a number (0 if no ledger entries exist yet).
 * @throws StockProductNotFoundError if the product row is not found.
 */
async function fetchCurrentBalanceLocked(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: number,
): Promise<number> {
  // Step 1: Lock the product row.
  const productRows = await tx
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .for("update");

  if (productRows.length === 0) {
    throw new StockProductNotFoundError(productId);
  }

  // Step 2: Read the most recent balance for this product.
  const lastRows = await tx
    .select({ balance: stockLedgerEntriesTable.balance })
    .from(stockLedgerEntriesTable)
    .where(eq(stockLedgerEntriesTable.productId, productId))
    .orderBy(desc(stockLedgerEntriesTable.id))
    .limit(1);

  return lastRows.length > 0 ? parseQty(lastRows[0]!.balance) : 0;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Creates a stock IN entry (goods received into warehouse).
 *
 * The running balance is computed as:
 *   new_balance = current_balance + inQty
 *
 * All reads and the insert happen inside a single transaction with an
 * exclusive lock on the product row to prevent concurrent balance corruption.
 *
 * @returns The newly inserted StockLedgerRow.
 * @throws StockProductNotFoundError if productId does not exist.
 * @throws StockInvalidQuantityError if inQty ≤ 0 or is not finite.
 */
export async function addStockIn(params: AddStockInParams): Promise<StockLedgerRow> {
  assertPositiveQty(params.inQty, "inQty");

  return db.transaction(async (tx) => {
    const currentBalance = await fetchCurrentBalanceLocked(tx, params.productId);
    const newBalance = currentBalance + params.inQty;

    const inserted = await tx
      .insert(stockLedgerEntriesTable)
      .values({
        productId: params.productId,
        date:       params.date,
        description: params.description,
        refNo:      params.refNo ?? null,
        inQty:      formatQty(params.inQty),
        outQty:     null,
        balance:    formatQty(newBalance),
      })
      .returning();

    return inserted[0]!;
  });
}

/**
 * Creates a stock OUT entry (goods dispatched from warehouse).
 *
 * The running balance is computed as:
 *   new_balance = current_balance - outQty
 *
 * Note: this service does not enforce a non-negative balance floor.
 * Business rules around minimum stock are the caller's responsibility.
 *
 * All reads and the insert happen inside a single transaction with an
 * exclusive lock on the product row to prevent concurrent balance corruption.
 *
 * @returns The newly inserted StockLedgerRow.
 * @throws StockProductNotFoundError if productId does not exist.
 * @throws StockInvalidQuantityError if outQty ≤ 0 or is not finite.
 */
export async function addStockOut(params: AddStockOutParams): Promise<StockLedgerRow> {
  assertPositiveQty(params.outQty, "outQty");

  return db.transaction(async (tx) => {
    const currentBalance = await fetchCurrentBalanceLocked(tx, params.productId);
    const newBalance = currentBalance - params.outQty;

    const inserted = await tx
      .insert(stockLedgerEntriesTable)
      .values({
        productId: params.productId,
        date:       params.date,
        description: params.description,
        refNo:      params.refNo ?? null,
        inQty:      null,
        outQty:     formatQty(params.outQty),
        balance:    formatQty(newBalance),
      })
      .returning();

    return inserted[0]!;
  });
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Returns the current stock balance for a product.
 *
 * Reads the balance column of the most recently inserted ledger row.
 * Returns 0 if no ledger entries exist for the product yet.
 *
 * This is a plain read — no locking. Do NOT use the returned value to
 * compute a balance for a new insert; use addStockIn / addStockOut instead.
 *
 * @throws StockProductNotFoundError if productId does not exist in products.
 */
export async function getProductStockBalance(productId: number): Promise<number> {
  // Verify the product exists.
  const productRows = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (productRows.length === 0) {
    throw new StockProductNotFoundError(productId);
  }

  const lastRows = await db
    .select({ balance: stockLedgerEntriesTable.balance })
    .from(stockLedgerEntriesTable)
    .where(eq(stockLedgerEntriesTable.productId, productId))
    .orderBy(desc(stockLedgerEntriesTable.id))
    .limit(1);

  return lastRows.length > 0 ? parseQty(lastRows[0]!.balance) : 0;
}

/**
 * Returns the stock ledger history for a product, ordered oldest-first.
 *
 * Supports optional date-range filtering and offset/limit pagination.
 *
 * @param params.productId  Required.
 * @param params.fromDate   Optional inclusive start — "YYYY-MM-DD".
 * @param params.toDate     Optional inclusive end   — "YYYY-MM-DD".
 * @param params.limit      Default 100.
 * @param params.offset     Default 0.
 * @returns Array of StockLedgerRow ordered by id ascending (insertion order).
 */
export async function getProductLedger(
  params: GetProductLedgerParams,
): Promise<StockLedgerRow[]> {
  const limit  = params.limit  ?? 100;
  const offset = params.offset ?? 0;

  // Build WHERE conditions incrementally.
  const conditions = [eq(stockLedgerEntriesTable.productId, params.productId)];

  if (params.fromDate != null) {
    conditions.push(gte(stockLedgerEntriesTable.date, params.fromDate));
  }

  if (params.toDate != null) {
    conditions.push(lte(stockLedgerEntriesTable.date, params.toDate));
  }

  return db
    .select()
    .from(stockLedgerEntriesTable)
    .where(and(...conditions))
    .orderBy(stockLedgerEntriesTable.id)   // insertion order = chronological order
    .limit(limit)
    .offset(offset);
}

// ---------------------------------------------------------------------------
// Re-export utility for callers that need to parse numeric columns
// ---------------------------------------------------------------------------

/**
 * Utility: converts a numeric column value (returned as string by the PG
 * driver) to a JavaScript number.  Exported so callers do not need to
 * re-implement the same parse logic.
 *
 * @example
 *   const balance = parseStockQty(row.balance); // "12.500" → 12.5
 */
export { parseQty as parseStockQty };
