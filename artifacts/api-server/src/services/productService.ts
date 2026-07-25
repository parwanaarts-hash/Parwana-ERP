/**
 * Product Service
 *
 * Master-data CRUD for the products table.
 *
 * Fields: itemCode, productName, urduName, category,
 *         scale (Ng|Set|Suit|Than), qty, stockFactor, length, rate, remarks.
 *
 * Delete protection: a product cannot be deleted while it has any stock
 * ledger history or is referenced in any gate pass / bill item table.
 * All reference checks run in parallel.
 *
 * itemCode uniqueness is enforced by a DB unique index; a 409 is returned
 * automatically by the errorHandler's 23505 handler on collision.
 */

import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  productsTable,
  purchaseBillItemsTable,
  purchaseGatePassItemsTable,
  returnBillItemsTable,
  returnGatePassItemsTable,
  salesBillItemsTable,
  saleGatePassItemsTable,
  stockLedgerEntriesTable,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductRow = typeof productsTable.$inferSelect;

const VALID_SCALES = ["Ng", "Set", "Suit", "Than"] as const;
type ProductScale = (typeof VALID_SCALES)[number];

export interface CreateProductInput {
  itemCode:     string;
  productName:  string;
  urduName?:    string | null;
  category?:    string | null;
  scale?:       ProductScale;
  qty?:         number;
  stockFactor?: number;
  length?:      string | null;
  rate?:        string | null;
  remarks?:     string | null;
}

export interface UpdateProductInput {
  itemCode?:    string;
  productName?: string;
  urduName?:    string | null;
  category?:    string | null;
  scale?:       ProductScale;
  qty?:         number;
  stockFactor?: number;
  length?:      string | null;
  rate?:        string | null;
  remarks?:     string | null;
}

export interface ListProductsInput {
  search?:   string;
  category?: string;
  scale?:    ProductScale;
  limit?:    number;
  offset?:   number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProductNotFoundError extends Error {
  constructor(id: number) {
    super(`Product not found: id=${id}`);
    this.name = "ProductNotFoundError";
  }
}

export class ProductInUseError extends Error {
  constructor(id: number) {
    super(
      `Product id=${id} cannot be deleted because it is referenced by ` +
        "existing gate passes, bills, or stock ledger entries.",
    );
    this.name = "ProductInUseError";
  }
}

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductValidationError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function validateItemCode(itemCode: string): void {
  if (!itemCode || itemCode.trim().length === 0)
    throw new ProductValidationError("itemCode is required and cannot be blank.");
  if (itemCode.trim().length > 100)
    throw new ProductValidationError("itemCode cannot exceed 100 characters.");
}

function validateProductName(productName: string): void {
  if (!productName || productName.trim().length === 0)
    throw new ProductValidationError("productName is required and cannot be blank.");
  if (productName.trim().length > 255)
    throw new ProductValidationError("productName cannot exceed 255 characters.");
}

async function fetchLocked(tx: Tx, id: number): Promise<ProductRow> {
  const rows = await tx
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id))
    .for("update");
  if (!rows[0]) throw new ProductNotFoundError(id);
  return rows[0];
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function getProduct(id: number): Promise<ProductRow | null> {
  const rows = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listProducts(
  input: ListProductsInput = {},
): Promise<{ rows: ProductRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conds = [];
  if (input.search) {
    conds.push(
      or(
        ilike(productsTable.productName, `%${input.search}%`),
        ilike(productsTable.itemCode,    `%${input.search}%`),
      )!,
    );
  }
  if (input.category !== undefined) conds.push(eq(productsTable.category, input.category));
  if (input.scale    !== undefined) conds.push(eq(productsTable.scale,    input.scale));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [total, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(productsTable)
      .where(where)
      .then((r) => r[0]?.total ?? 0),
    db
      .select()
      .from(productsTable)
      .where(where)
      .orderBy(asc(productsTable.productName), asc(productsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total };
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductRow> {
  validateItemCode(input.itemCode);
  validateProductName(input.productName);

  const rows = await db
    .insert(productsTable)
    .values({
      itemCode:    input.itemCode.trim(),
      productName: input.productName.trim(),
      urduName:    input.urduName    ?? null,
      category:    input.category    ?? null,
      scale:       input.scale       ?? "Ng",
      qty:         input.qty         ?? 0,
      stockFactor: input.stockFactor ?? 1,
      length:      input.length      ?? null,
      rate:        input.rate        ?? null,
      remarks:     input.remarks     ?? null,
    })
    .returning();
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updateProduct(
  id: number,
  input: UpdateProductInput,
): Promise<ProductRow> {
  if (input.itemCode    !== undefined) validateItemCode(input.itemCode);
  if (input.productName !== undefined) validateProductName(input.productName);

  return db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    const rows = await tx
      .update(productsTable)
      .set({
        ...(input.itemCode    !== undefined && { itemCode:    input.itemCode.trim() }),
        ...(input.productName !== undefined && { productName: input.productName.trim() }),
        ...(input.urduName    !== undefined && { urduName:    input.urduName }),
        ...(input.category    !== undefined && { category:    input.category }),
        ...(input.scale       !== undefined && { scale:       input.scale }),
        ...(input.qty         !== undefined && { qty:         input.qty }),
        ...(input.stockFactor !== undefined && { stockFactor: input.stockFactor }),
        ...(input.length      !== undefined && { length:      input.length }),
        ...(input.rate        !== undefined && { rate:        input.rate }),
        ...(input.remarks     !== undefined && { remarks:     input.remarks }),
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, id))
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteProduct(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    // Check all referencing tables in parallel.
    const counts = await Promise.all([
      tx.select({ n: count() }).from(stockLedgerEntriesTable)
        .where(eq(stockLedgerEntriesTable.productId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(purchaseGatePassItemsTable)
        .where(eq(purchaseGatePassItemsTable.productId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(saleGatePassItemsTable)
        .where(eq(saleGatePassItemsTable.productId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(returnGatePassItemsTable)
        .where(eq(returnGatePassItemsTable.productId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(purchaseBillItemsTable)
        .where(eq(purchaseBillItemsTable.productId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(salesBillItemsTable)
        .where(eq(salesBillItemsTable.productId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
      tx.select({ n: count() }).from(returnBillItemsTable)
        .where(eq(returnBillItemsTable.productId, id))
        .then((r) => Number(r[0]?.n ?? 0)),
    ]);

    const totalRefs = counts.reduce((a, b) => a + b, 0);
    if (totalRefs > 0) throw new ProductInUseError(id);

    await tx.delete(productsTable).where(eq(productsTable.id, id));
  });
}
