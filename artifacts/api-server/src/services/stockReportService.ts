/**
 * Stock Report Service — Read-Only
 *
 * Five reports:
 *   stockList              — current balance per product (correlated subquery on stock_ledger_entries)
 *   productLedger          — full stock movement history for one product
 *   purchaseGatePassRegister — purchase_gate_passes JOIN purchase_parties
 *   saleGatePassRegister   — sale_gate_passes      JOIN sale_parties
 *   returnGatePassRegister — return_gate_passes     JOIN sale_parties
 *
 * No writes of any kind — read-only throughout.
 * COUNT and SELECT run in parallel for every paginated endpoint.
 * Existing FK/date indexes are used by all queries.
 */

import { and, asc, count, desc, eq, gte, ilike, isNull, lte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  productsTable,
  stockLedgerEntriesTable,
  purchaseGatePassesTable,
  purchasePartiesTable,
  saleGatePassesTable,
  salePartiesTable,
  returnGatePassesTable,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Shared paginated result type
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  rows:  T[];
  total: number;
}

// ---------------------------------------------------------------------------
// 1. Stock List
// ---------------------------------------------------------------------------

export interface StockListFilters {
  productId?:    number;
  /** Matches products.sub_category_id */
  categoryId?:   number;
  shikanjaId?:   number;
  limit?:        number;
  offset?:       number;
}

export interface StockListRow {
  id:            number;
  itemCode:      string;
  productName:   string;
  type:          string;
  subCategoryId: number | null;
  shikanjaId:    number | null;
  /** Current stock balance — "0.000" when no stock movement exists. */
  balance:       string;
}

/**
 * Returns paginated product list with the current stock balance for each product.
 *
 * Balance is obtained via a correlated subquery (ORDER BY id DESC LIMIT 1) on
 * stock_ledger_entries — this uses the existing primary-key index efficiently.
 * Products with no ledger entries show "0.000".
 *
 * Supports filtering by productId, categoryId (subCategoryId), shikanjaId.
 * Ordered by productName ASC.
 */
export async function stockList(
  f: StockListFilters = {}
): Promise<PaginatedResult<StockListRow>> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = [];
  if (f.productId  !== undefined) conds.push(eq(productsTable.id,            f.productId));
  if (f.categoryId !== undefined) conds.push(eq(productsTable.subCategoryId, f.categoryId));
  if (f.shikanjaId !== undefined) conds.push(eq(productsTable.shikanjaId,    f.shikanjaId));

  const where = conds.length > 0 ? and(...conds) : undefined;

  // Correlated subquery: latest balance row per product (uses PK index).
  const balanceSubquery = sql<string>`COALESCE((
    SELECT ${stockLedgerEntriesTable.balance}
    FROM   ${stockLedgerEntriesTable}
    WHERE  ${stockLedgerEntriesTable.productId} = ${productsTable.id}
    ORDER  BY ${stockLedgerEntriesTable.id} DESC
    LIMIT  1
  ), '0.000')`;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(productsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:            productsTable.id,
        itemCode:      productsTable.itemCode,
        productName:   productsTable.productName,
        type:          productsTable.type,
        subCategoryId: productsTable.subCategoryId,
        shikanjaId:    productsTable.shikanjaId,
        balance:       balanceSubquery,
      })
      .from(productsTable)
      .where(where)
      .orderBy(asc(productsTable.productName), asc(productsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}

// ---------------------------------------------------------------------------
// 2. Product Ledger
// ---------------------------------------------------------------------------

export interface ProductLedgerFilters {
  /** Required — the product whose movement history is returned. */
  productId: number;
  /** Inclusive start date — "YYYY-MM-DD". */
  fromDate?:  string;
  /** Inclusive end date — "YYYY-MM-DD". */
  toDate?:    string;
  limit?:     number;
  offset?:    number;
}

export interface ProductLedgerRow {
  id:          number;
  date:        string;
  description: string;
  refNo:       string | null;
  inQty:       string | null;
  outQty:      string | null;
  balance:     string;
}

/**
 * Returns the complete stock movement history for one product.
 *
 * Ordered chronologically (date ASC, id ASC) so the running balance reads
 * top-to-bottom in the correct sequence.
 * Supports optional date-range filtering.
 */
export async function productLedger(
  f: ProductLedgerFilters
): Promise<PaginatedResult<ProductLedgerRow>> {
  const limit  = f.limit  ?? 100;
  const offset = f.offset ?? 0;

  const conds = [eq(stockLedgerEntriesTable.productId, f.productId)];
  if (f.fromDate !== undefined) conds.push(gte(stockLedgerEntriesTable.date, f.fromDate));
  if (f.toDate   !== undefined) conds.push(lte(stockLedgerEntriesTable.date, f.toDate));

  const where = and(...conds);

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(stockLedgerEntriesTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:          stockLedgerEntriesTable.id,
        date:        stockLedgerEntriesTable.date,
        description: stockLedgerEntriesTable.description,
        refNo:       stockLedgerEntriesTable.refNo,
        inQty:       stockLedgerEntriesTable.inQty,
        outQty:      stockLedgerEntriesTable.outQty,
        balance:     stockLedgerEntriesTable.balance,
      })
      .from(stockLedgerEntriesTable)
      .where(where)
      .orderBy(asc(stockLedgerEntriesTable.date), asc(stockLedgerEntriesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}

// ---------------------------------------------------------------------------
// 3. Purchase Gate Pass Register
// ---------------------------------------------------------------------------

export interface PurchaseGPRegisterFilters {
  fromDate?:     string;
  toDate?:       string;
  /** purchasePartyId */
  partyId?:      number;
  /** Substring match on gp_number (case-insensitive). */
  gpNumber?:     string;
  /** When true, only returns gate passes not yet linked to a Purchase Bill. */
  unlinkedOnly?: boolean;
  limit?:        number;
  offset?:       number;
}

export interface PurchaseGPRegisterRow {
  id:              number;
  gpNumber:        string;
  date:            string;
  partyId:         number;
  partyName:       string;
  /** Null when not yet linked to a Purchase Bill. */
  purchaseBillId:  number | null;
}

/**
 * Returns paginated Purchase Gate Passes with the linked Purchase Party name.
 * Sorted newest-first (date DESC, id DESC).
 */
export async function purchaseGatePassRegister(
  f: PurchaseGPRegisterFilters = {}
): Promise<PaginatedResult<PurchaseGPRegisterRow>> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = [];
  if (f.fromDate     !== undefined) conds.push(gte(purchaseGatePassesTable.date,            f.fromDate));
  if (f.toDate       !== undefined) conds.push(lte(purchaseGatePassesTable.date,            f.toDate));
  if (f.partyId      !== undefined) conds.push(eq(purchaseGatePassesTable.purchasePartyId,  f.partyId));
  if (f.gpNumber     !== undefined) conds.push(ilike(purchaseGatePassesTable.gpNumber,      `%${f.gpNumber}%`));
  if (f.unlinkedOnly === true)      conds.push(isNull(purchaseGatePassesTable.purchaseBillId));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(purchaseGatePassesTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:             purchaseGatePassesTable.id,
        gpNumber:       purchaseGatePassesTable.gpNumber,
        date:           purchaseGatePassesTable.date,
        partyId:        purchaseGatePassesTable.purchasePartyId,
        partyName:      purchasePartiesTable.name,
        purchaseBillId: purchaseGatePassesTable.purchaseBillId,
      })
      .from(purchaseGatePassesTable)
      .innerJoin(
        purchasePartiesTable,
        eq(purchaseGatePassesTable.purchasePartyId, purchasePartiesTable.id)
      )
      .where(where)
      .orderBy(desc(purchaseGatePassesTable.date), desc(purchaseGatePassesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}

// ---------------------------------------------------------------------------
// 4. Sale Gate Pass Register
// ---------------------------------------------------------------------------

export interface SaleGPRegisterFilters {
  fromDate?:     string;
  toDate?:       string;
  /** salePartyId */
  partyId?:      number;
  gpNumber?:     string;
  /** When true, only returns gate passes not yet linked to a Sales Bill. */
  unlinkedOnly?: boolean;
  limit?:        number;
  offset?:       number;
}

export interface SaleGPRegisterRow {
  id:           number;
  gpNumber:     string;
  date:         string;
  partyId:      number;
  partyName:    string;
  /** Null when not yet linked to a Sales Bill. */
  salesBillId:  number | null;
}

/**
 * Returns paginated Sale Gate Passes with the linked Sale Party name.
 * Sorted newest-first (date DESC, id DESC).
 */
export async function saleGatePassRegister(
  f: SaleGPRegisterFilters = {}
): Promise<PaginatedResult<SaleGPRegisterRow>> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = [];
  if (f.fromDate     !== undefined) conds.push(gte(saleGatePassesTable.date,          f.fromDate));
  if (f.toDate       !== undefined) conds.push(lte(saleGatePassesTable.date,          f.toDate));
  if (f.partyId      !== undefined) conds.push(eq(saleGatePassesTable.salePartyId,    f.partyId));
  if (f.gpNumber     !== undefined) conds.push(ilike(saleGatePassesTable.gpNumber,    `%${f.gpNumber}%`));
  if (f.unlinkedOnly === true)      conds.push(isNull(saleGatePassesTable.salesBillId));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(saleGatePassesTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:          saleGatePassesTable.id,
        gpNumber:    saleGatePassesTable.gpNumber,
        date:        saleGatePassesTable.date,
        partyId:     saleGatePassesTable.salePartyId,
        partyName:   salePartiesTable.name,
        salesBillId: saleGatePassesTable.salesBillId,
      })
      .from(saleGatePassesTable)
      .innerJoin(
        salePartiesTable,
        eq(saleGatePassesTable.salePartyId, salePartiesTable.id)
      )
      .where(where)
      .orderBy(desc(saleGatePassesTable.date), desc(saleGatePassesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}

// ---------------------------------------------------------------------------
// 5. Return Gate Pass Register
// ---------------------------------------------------------------------------

export interface ReturnGPRegisterFilters {
  fromDate?:     string;
  toDate?:       string;
  /** salePartyId */
  partyId?:      number;
  gpNumber?:     string;
  /** When true, only returns gate passes not yet linked to a Return Bill. */
  unlinkedOnly?: boolean;
  limit?:        number;
  offset?:       number;
}

export interface ReturnGPRegisterRow {
  id:            number;
  gpNumber:      string;
  date:          string;
  partyId:       number;
  partyName:     string;
  /** Null when not yet linked to a Return Bill. */
  returnBillId:  number | null;
}

/**
 * Returns paginated Return Gate Passes with the linked Sale Party name.
 * Sorted newest-first (date DESC, id DESC).
 */
export async function returnGatePassRegister(
  f: ReturnGPRegisterFilters = {}
): Promise<PaginatedResult<ReturnGPRegisterRow>> {
  const limit  = f.limit  ?? 50;
  const offset = f.offset ?? 0;

  const conds = [];
  if (f.fromDate     !== undefined) conds.push(gte(returnGatePassesTable.date,           f.fromDate));
  if (f.toDate       !== undefined) conds.push(lte(returnGatePassesTable.date,           f.toDate));
  if (f.partyId      !== undefined) conds.push(eq(returnGatePassesTable.salePartyId,     f.partyId));
  if (f.gpNumber     !== undefined) conds.push(ilike(returnGatePassesTable.gpNumber,     `%${f.gpNumber}%`));
  if (f.unlinkedOnly === true)      conds.push(isNull(returnGatePassesTable.returnBillId));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(returnGatePassesTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),

    db
      .select({
        id:           returnGatePassesTable.id,
        gpNumber:     returnGatePassesTable.gpNumber,
        date:         returnGatePassesTable.date,
        partyId:      returnGatePassesTable.salePartyId,
        partyName:    salePartiesTable.name,
        returnBillId: returnGatePassesTable.returnBillId,
      })
      .from(returnGatePassesTable)
      .innerJoin(
        salePartiesTable,
        eq(returnGatePassesTable.salePartyId, salePartiesTable.id)
      )
      .where(where)
      .orderBy(desc(returnGatePassesTable.date), desc(returnGatePassesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
