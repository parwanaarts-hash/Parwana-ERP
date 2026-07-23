/**
 * Dashboard Service — Read-Only
 *
 * Five aggregate endpoints:
 *   summary            — totals: products, parties, stock items, stock qty
 *   todaySummary       — today's document counts across all five transaction types
 *   outstandingSummary — total receivable (sale) and payable (purchase) from ledger
 *   recentTransactions — latest N rows from each of the five transaction tables
 *   lowStock           — products whose current stock balance is at or below a threshold
 *
 * No writes of any kind — fully read-only.
 * Independent queries within each function are batched with Promise.all.
 * PostgreSQL DISTINCT ON is used via sql`` for per-party / per-product latest-balance reads.
 */

import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ledgerEntriesTable,
  paymentPaidsTable,
  paymentReceivesTable,
  productsTable,
  purchaseBillsTable,
  purchasePartiesTable,
  returnBillsTable,
  salesBillsTable,
  salePartiesTable,
  stockLedgerEntriesTable,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Internal helper — today's ISO date (server timezone)
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1. Dashboard Summary
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  totalProducts:       number;
  totalSaleParties:    number;
  totalPurchaseParties: number;
  /** Number of distinct products with a current stock balance > 0. */
  currentStockItems:   number;
  /** Sum of current stock balances across all products (3-decimal string). */
  currentStockQty:     string;
}

/**
 * Returns master-count totals and current stock aggregates.
 *
 * Stock figures use DISTINCT ON (product_id) to get the latest balance per
 * product in a single scan of stock_ledger_entries, then aggregates in the
 * outer query — no N+1 product lookups.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [
    productCount,
    salePartyCount,
    purchasePartyCount,
    stockAgg,
  ] = await Promise.all([
    db.select({ total: count() }).from(productsTable)
      .then((r) => r[0]?.total ?? 0),

    db.select({ total: count() }).from(salePartiesTable)
      .then((r) => r[0]?.total ?? 0),

    db.select({ total: count() }).from(purchasePartiesTable)
      .then((r) => r[0]?.total ?? 0),

    // DISTINCT ON gets the latest stock_ledger_entries row per product.
    // The outer SELECT then counts items > 0 and sums balances.
    db.execute<{ items: string; qty: string }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE balance > 0)                        AS items,
        COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS qty
      FROM (
        SELECT DISTINCT ON (product_id) balance::numeric
        FROM   stock_ledger_entries
        ORDER  BY product_id, id DESC
      ) latest
    `).then((r) => r.rows[0] ?? { items: "0", qty: "0" }),
  ]);

  return {
    totalProducts:        Number(productCount),
    totalSaleParties:     Number(salePartyCount),
    totalPurchaseParties: Number(purchasePartyCount),
    currentStockItems:    Number(stockAgg.items),
    currentStockQty:      Number(stockAgg.qty).toFixed(3),
  };
}

// ---------------------------------------------------------------------------
// 2. Today's Summary
// ---------------------------------------------------------------------------

export interface TodaySummary {
  date:                 string;
  purchaseBillsCount:   number;
  salesBillsCount:      number;
  returnBillsCount:     number;
  paymentReceivesCount: number;
  paymentPaidsCount:    number;
}

/**
 * Counts documents dated today across all five transaction tables.
 * All five COUNT queries run in parallel.
 */
export async function getTodaySummary(): Promise<TodaySummary> {
  const today = todayISO();

  const [pb, sb, rb, pr, pp] = await Promise.all([
    db.select({ total: count() }).from(purchaseBillsTable)
      .where(eq(purchaseBillsTable.billDate, today))
      .then((r) => r[0]?.total ?? 0),

    db.select({ total: count() }).from(salesBillsTable)
      .where(eq(salesBillsTable.billDate, today))
      .then((r) => r[0]?.total ?? 0),

    db.select({ total: count() }).from(returnBillsTable)
      .where(eq(returnBillsTable.billDate, today))
      .then((r) => r[0]?.total ?? 0),

    db.select({ total: count() }).from(paymentReceivesTable)
      .where(eq(paymentReceivesTable.date, today))
      .then((r) => r[0]?.total ?? 0),

    db.select({ total: count() }).from(paymentPaidsTable)
      .where(eq(paymentPaidsTable.date, today))
      .then((r) => r[0]?.total ?? 0),
  ]);

  return {
    date:                 today,
    purchaseBillsCount:   Number(pb),
    salesBillsCount:      Number(sb),
    returnBillsCount:     Number(rb),
    paymentReceivesCount: Number(pr),
    paymentPaidsCount:    Number(pp),
  };
}

// ---------------------------------------------------------------------------
// 3. Outstanding Summary
// ---------------------------------------------------------------------------

export interface OutstandingSummary {
  /** Sum of latest positive balances for all sale parties (customer receivable). */
  totalCustomerReceivable: string;
  /** Sum of latest positive balances for all purchase parties (supplier payable). */
  totalSupplierPayable:    string;
}

/**
 * Aggregates current outstanding from ledger_entries.
 *
 * Strategy: DISTINCT ON (party_id) ordered by id DESC gives the latest balance
 * per party in one index scan. The outer query sums positive balances.
 *
 * A positive balance on the sale-party ledger means the customer owes us
 * (receivable). A positive balance on the purchase-party ledger means we owe
 * the supplier (payable). Negative balances (overpayments) are excluded from
 * each respective total.
 */
export async function getOutstandingSummary(): Promise<OutstandingSummary> {
  const [receivable, payable] = await Promise.all([
    db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(balance), 0) AS total
      FROM (
        SELECT DISTINCT ON (sale_party_id) balance::numeric
        FROM   ledger_entries
        WHERE  sale_party_id IS NOT NULL
        ORDER  BY sale_party_id, id DESC
      ) latest
      WHERE  balance > 0
    `).then((r) => r.rows[0]?.total ?? "0"),

    db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(balance), 0) AS total
      FROM (
        SELECT DISTINCT ON (purchase_party_id) balance::numeric
        FROM   ledger_entries
        WHERE  purchase_party_id IS NOT NULL
        ORDER  BY purchase_party_id, id DESC
      ) latest
      WHERE  balance > 0
    `).then((r) => r.rows[0]?.total ?? "0"),
  ]);

  return {
    totalCustomerReceivable: Number(receivable).toFixed(2),
    totalSupplierPayable:    Number(payable).toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// 4. Recent Transactions
// ---------------------------------------------------------------------------

export interface RecentPurchaseBill {
  id:         number;
  billNumber: string;
  billDate:   string;
  partyName:  string;
  billAmount: string | null;
}

export interface RecentSalesBill {
  id:         number;
  billNumber: string;
  billDate:   string;
  partyName:  string;
  billAmount: string | null;
}

export interface RecentReturnBill {
  id:         number;
  billNumber: string;
  billDate:   string;
  partyName:  string;
  billAmount: string | null;
}

export interface RecentPaymentReceive {
  id:        number;
  prNumber:  string;
  date:      string;
  partyName: string;
  amount:    string | null;
}

export interface RecentPaymentPaid {
  id:        number;
  ppNumber:  string;
  date:      string;
  partyName: string;
  amount:    string | null;
}

export interface RecentTransactions {
  purchaseBills:    RecentPurchaseBill[];
  salesBills:       RecentSalesBill[];
  returnBills:      RecentReturnBill[];
  paymentReceives:  RecentPaymentReceive[];
  paymentPaids:     RecentPaymentPaid[];
}

/**
 * Returns the latest `limit` rows from each of the five transaction tables,
 * joined with the relevant party table for the party name.
 * All five queries run in parallel.
 *
 * @param limit Number of rows per transaction type. Defaults to 10.
 */
export async function getRecentTransactions(
  limit = 10
): Promise<RecentTransactions> {
  const n = Math.min(Math.max(1, limit), 100);

  const [pb, sb, rb, pr, pp] = await Promise.all([
    db
      .select({
        id:         purchaseBillsTable.id,
        billNumber: purchaseBillsTable.billNumber,
        billDate:   purchaseBillsTable.billDate,
        partyName:  purchasePartiesTable.name,
        billAmount: purchaseBillsTable.billAmount,
      })
      .from(purchaseBillsTable)
      .innerJoin(purchasePartiesTable, eq(purchaseBillsTable.purchasePartyId, purchasePartiesTable.id))
      .orderBy(desc(purchaseBillsTable.billDate), desc(purchaseBillsTable.id))
      .limit(n),

    db
      .select({
        id:         salesBillsTable.id,
        billNumber: salesBillsTable.billNumber,
        billDate:   salesBillsTable.billDate,
        partyName:  salePartiesTable.name,
        billAmount: salesBillsTable.billAmount,
      })
      .from(salesBillsTable)
      .innerJoin(salePartiesTable, eq(salesBillsTable.salePartyId, salePartiesTable.id))
      .orderBy(desc(salesBillsTable.billDate), desc(salesBillsTable.id))
      .limit(n),

    db
      .select({
        id:         returnBillsTable.id,
        billNumber: returnBillsTable.billNumber,
        billDate:   returnBillsTable.billDate,
        partyName:  salePartiesTable.name,
        billAmount: returnBillsTable.billAmount,
      })
      .from(returnBillsTable)
      .innerJoin(salePartiesTable, eq(returnBillsTable.salePartyId, salePartiesTable.id))
      .orderBy(desc(returnBillsTable.billDate), desc(returnBillsTable.id))
      .limit(n),

    db
      .select({
        id:        paymentReceivesTable.id,
        prNumber:  paymentReceivesTable.prNumber,
        date:      paymentReceivesTable.date,
        partyName: salePartiesTable.name,
        amount:    paymentReceivesTable.amount,
      })
      .from(paymentReceivesTable)
      .innerJoin(salePartiesTable, eq(paymentReceivesTable.salePartyId, salePartiesTable.id))
      .orderBy(desc(paymentReceivesTable.date), desc(paymentReceivesTable.id))
      .limit(n),

    db
      .select({
        id:        paymentPaidsTable.id,
        ppNumber:  paymentPaidsTable.ppNumber,
        date:      paymentPaidsTable.date,
        partyName: purchasePartiesTable.name,
        amount:    paymentPaidsTable.amount,
      })
      .from(paymentPaidsTable)
      .innerJoin(purchasePartiesTable, eq(paymentPaidsTable.purchasePartyId, purchasePartiesTable.id))
      .orderBy(desc(paymentPaidsTable.date), desc(paymentPaidsTable.id))
      .limit(n),
  ]);

  return {
    purchaseBills:   pb,
    salesBills:      sb,
    returnBills:     rb,
    paymentReceives: pr,
    paymentPaids:    pp,
  };
}

// ---------------------------------------------------------------------------
// 5. Low Stock
// ---------------------------------------------------------------------------

export interface LowStockRow {
  id:          number;
  itemCode:    string;
  productName: string;
  type:        string;
  balance:     string;
}

export interface LowStockResult {
  rows:      LowStockRow[];
  total:     number;
  threshold: string;
}

/**
 * Returns products whose current stock balance is at or below `threshold`.
 *
 * Uses DISTINCT ON (product_id) to get the latest balance per product
 * efficiently, then filters and paginates in the outer query.
 * Products with no stock ledger entries are treated as balance = 0.
 *
 * @param threshold Stock balance at or below which a product is "low". Default 0.
 * @param limit     Page size. Default 50.
 * @param offset    Page offset. Default 0.
 */
export async function getLowStock(
  threshold = 0,
  limit     = 50,
  offset    = 0,
): Promise<LowStockResult> {
  const thresholdStr = threshold.toFixed(3);
  const n = Math.min(Math.max(1, limit), 500);
  const o = Math.max(0, offset);

  // Products with ledger entries: latest balance per product via DISTINCT ON.
  // Products with no entries default to 0 — handled by LEFT JOIN LATERAL below.
  const rawRows = await db.execute<{
    id:           string;
    item_code:    string;
    product_name: string;
    type:         string;
    balance:      string;
    total:        string;
  }>(sql`
    SELECT
      p.id,
      p.item_code,
      p.product_name,
      p.type,
      COALESCE(latest.balance, 0) AS balance,
      COUNT(*) OVER ()            AS total
    FROM products p
    LEFT JOIN LATERAL (
      SELECT balance::numeric
      FROM   stock_ledger_entries
      WHERE  product_id = p.id
      ORDER  BY id DESC
      LIMIT  1
    ) latest ON true
    WHERE COALESCE(latest.balance, 0) <= ${thresholdStr}::numeric
    ORDER BY COALESCE(latest.balance, 0) ASC, p.product_name ASC
    LIMIT  ${n}
    OFFSET ${o}
  `);

  const rows     = rawRows.rows;
  const total    = rows.length > 0 ? Number(rows[0]!.total) : 0;

  return {
    rows: rows.map((r) => ({
      id:          Number(r.id),
      itemCode:    r.item_code,
      productName: r.product_name,
      type:        r.type,
      balance:     Number(r.balance).toFixed(3),
    })),
    total,
    threshold: thresholdStr,
  };
}
