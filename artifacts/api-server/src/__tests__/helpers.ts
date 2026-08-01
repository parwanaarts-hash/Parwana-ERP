/**
 * Shared test helpers for Purchase module integration tests.
 *
 * Design principles:
 *  - All helpers use the same `db` singleton as the app under test.
 *  - `cleanupTestData` deletes by partyId so it catches every record
 *    created during a test suite without needing to track individual IDs.
 *  - Cleanup order respects FK constraints (ledger → bills → gate passes →
 *    stock entries → products → parties).
 */

import { db } from "@workspace/db";
import {
  purchasePartiesTable,
  productsTable,
  purchaseGatePassesTable,
  purchaseBillsTable,
  stockLedgerEntriesTable,
  ledgerEntriesTable,
  numberSeriesTable,
} from "@workspace/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Random suffix — short unique string for test data names/codes.
// ---------------------------------------------------------------------------

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ---------------------------------------------------------------------------
// Seed guard — ensures the number_series rows exist before tests run.
// ---------------------------------------------------------------------------

const NUMBER_SERIES_SEED = [
  { documentType: "Purchase Gate Pass", prefix: "PGP", currentNumber: 0 },
  { documentType: "Sale Gate Pass",     prefix: "SGP", currentNumber: 0 },
  { documentType: "Return Gate Pass",   prefix: "RGP", currentNumber: 0 },
  { documentType: "Purchase Bill",      prefix: "PB",  currentNumber: 0 },
  { documentType: "Sales Bill",         prefix: "SB",  currentNumber: 0 },
  { documentType: "Return Bill",        prefix: "RB",  currentNumber: 0 },
  { documentType: "Payment Receive",    prefix: "PR",  currentNumber: 0 },
  { documentType: "Payment Paid",       prefix: "PP",  currentNumber: 0 },
] as const;

export async function ensureNumberSeries(): Promise<void> {
  await db
    .insert(numberSeriesTable)
    .values(NUMBER_SERIES_SEED.map((r) => ({ ...r })))
    .onConflictDoNothing({ target: numberSeriesTable.documentType });
}

// ---------------------------------------------------------------------------
// Peek the current counter for a document type (before a document is created).
// ---------------------------------------------------------------------------

export async function peekCurrentNumber(documentType: string): Promise<number> {
  const rows = await db
    .select({ currentNumber: numberSeriesTable.currentNumber })
    .from(numberSeriesTable)
    .where(eq(numberSeriesTable.documentType, documentType));

  if (rows.length === 0) {
    throw new Error(`Number series not found for documentType: ${documentType}`);
  }
  return rows[0]!.currentNumber;
}

// ---------------------------------------------------------------------------
// Create test entities
// ---------------------------------------------------------------------------

export async function createTestParty(name: string): Promise<{ id: number; name: string }> {
  const rows = await db
    .insert(purchasePartiesTable)
    .values({ name })
    .returning({ id: purchasePartiesTable.id, name: purchasePartiesTable.name });
  return rows[0]!;
}

export async function createTestProduct(
  codeSuffix: string,
  type: "Set" | "Than" | "Suit" = "Set"
): Promise<{ id: number; itemCode: string; productName: string }> {
  const rows = await db
    .insert(productsTable)
    .values({
      itemCode:    `TST-${codeSuffix}`,
      productName: `Test Product ${codeSuffix}`,
      scale: type,
    })
    .returning({
      id:          productsTable.id,
      itemCode:    productsTable.itemCode,
      productName: productsTable.productName,
    });
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// Stock ledger queries
// ---------------------------------------------------------------------------

export async function getStockBalance(productId: number): Promise<number> {
  const rows = await db
    .select({ balance: stockLedgerEntriesTable.balance })
    .from(stockLedgerEntriesTable)
    .where(eq(stockLedgerEntriesTable.productId, productId))
    .orderBy(desc(stockLedgerEntriesTable.id))
    .limit(1);

  return rows.length > 0 ? parseFloat(rows[0]!.balance) : 0;
}

export async function getStockEntries(productId: number) {
  return db
    .select()
    .from(stockLedgerEntriesTable)
    .where(eq(stockLedgerEntriesTable.productId, productId))
    .orderBy(stockLedgerEntriesTable.id);
}

// ---------------------------------------------------------------------------
// Financial ledger queries
// ---------------------------------------------------------------------------

export async function getPartyLedgerBalance(purchasePartyId: number): Promise<number> {
  const rows = await db
    .select({ balance: ledgerEntriesTable.balance })
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.purchasePartyId, purchasePartyId))
    .orderBy(desc(ledgerEntriesTable.id))
    .limit(1);

  return rows.length > 0 ? parseFloat(rows[0]!.balance) : 0;
}

export async function getPartyLedgerEntries(purchasePartyId: number) {
  return db
    .select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.purchasePartyId, purchasePartyId))
    .orderBy(ledgerEntriesTable.id);
}

// ---------------------------------------------------------------------------
// Cleanup — removes ALL test data for the given party/product IDs.
//
// FK-constraint-safe order:
//   1. ledger_entries (references purchase_parties → must go before parties)
//   2. purchase_bills → cascades to purchase_bill_items
//                    → ON DELETE SET NULL on purchase_gate_passes.purchase_bill_id
//   3. purchase_gate_passes → cascades to purchase_gate_pass_items
//   4. stock_ledger_entries (references products → must go before products)
//   5. products
//   6. purchase_parties
// ---------------------------------------------------------------------------

export async function cleanupTestData(
  partyIds: number[],
  productIds: number[]
): Promise<void> {
  if (partyIds.length > 0) {
    await db.delete(ledgerEntriesTable).where(
      inArray(ledgerEntriesTable.purchasePartyId, partyIds)
    );
    await db.delete(purchaseBillsTable).where(
      inArray(purchaseBillsTable.purchasePartyId, partyIds)
    );
    await db.delete(purchaseGatePassesTable).where(
      inArray(purchaseGatePassesTable.purchasePartyId, partyIds)
    );
  }
  if (productIds.length > 0) {
    await db.delete(stockLedgerEntriesTable).where(
      inArray(stockLedgerEntriesTable.productId, productIds)
    );
    await db.delete(productsTable).where(
      inArray(productsTable.id, productIds)
    );
  }
  if (partyIds.length > 0) {
    await db.delete(purchasePartiesTable).where(
      inArray(purchasePartiesTable.id, partyIds)
    );
  }
}
