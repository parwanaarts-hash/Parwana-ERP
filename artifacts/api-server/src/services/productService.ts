/**
 * Product Service
 *
 * Master-data CRUD for the products table.
 *
 * Fields: itemCode, productName, type (Set | Than | Suit),
 *         subCategoryId (nullable FK → categories), shikanjaId (nullable FK → shikanja).
 *
 * Delete protection: a product cannot be deleted while it has any stock
 * ledger history or is referenced in any gate pass / bill item table.
 * All reference checks run in parallel.
 *
 * itemCode uniqueness is enforced by a DB unique index; a 409 is returned
 * automatically by the errorHandler's 23505 handler on collision.
 */

import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  categoriesTable,
  productsTable,
  purchaseBillItemsTable,
  purchaseGatePassItemsTable,
  returnBillItemsTable,
  returnGatePassItemsTable,
  salesBillItemsTable,
  saleGatePassItemsTable,
  shikanjaTable,
  stockLedgerEntriesTable,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductRow = typeof productsTable.$inferSelect;

const VALID_TYPES = ["Set", "Than", "Suit"] as const;
type ProductType = typeof VALID_TYPES[number];

export interface CreateProductInput {
  itemCode:      string;
  productName:   string;
  type:          ProductType;
  subCategoryId?: number | null;
  shikanjaId?:   number | null;
}

export interface UpdateProductInput {
  itemCode?:     string;
  productName?:  string;
  type?:         ProductType;
  subCategoryId?: number | null;
  shikanjaId?:   number | null;
}

export interface ListProductsInput {
  /** Substring match on productName or itemCode. */
  search?:       string;
  type?:         ProductType;
  subCategoryId?: number;
  shikanjaId?:   number;
  limit?:        number;
  offset?:       number;
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

export class ProductCategoryNotFoundError extends Error {
  constructor(subCategoryId: number) {
    super(`Category (sub-category) not found: id=${subCategoryId}`);
    this.name = "ProductCategoryNotFoundError";
  }
}

export class ProductShikanjaNotFoundError extends Error {
  constructor(shikanjaId: number) {
    super(`Shikanja not found: id=${shikanjaId}`);
    this.name = "ProductShikanjaNotFoundError";
  }
}

export class ProductInUseError extends Error {
  constructor(id: number) {
    super(
      `Product id=${id} cannot be deleted because it is referenced by ` +
      "existing gate passes, bills, or stock ledger entries."
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

function validateType(type: string): asserts type is ProductType {
  if (!VALID_TYPES.includes(type as ProductType)) {
    throw new ProductValidationError(
      `type must be one of: ${VALID_TYPES.join(", ")}. Received: "${type}".`
    );
  }
}

function validateItemCode(itemCode: string): void {
  if (!itemCode || itemCode.trim().length === 0) {
    throw new ProductValidationError("itemCode is required and cannot be blank.");
  }
  if (itemCode.trim().length > 100) {
    throw new ProductValidationError("itemCode cannot exceed 100 characters.");
  }
}

function validateProductName(productName: string): void {
  if (!productName || productName.trim().length === 0) {
    throw new ProductValidationError("productName is required and cannot be blank.");
  }
  if (productName.trim().length > 255) {
    throw new ProductValidationError("productName cannot exceed 255 characters.");
  }
}

async function fetchLocked(tx: Tx, id: number): Promise<ProductRow> {
  const rows = await tx
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id))
    .for("update");
  if (rows.length === 0) throw new ProductNotFoundError(id);
  return rows[0]!;
}

async function assertSubCategoryExists(tx: Tx, subCategoryId: number): Promise<void> {
  const rows = await tx
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, subCategoryId));
  if (rows.length === 0) throw new ProductCategoryNotFoundError(subCategoryId);
}

async function assertShikanjaExists(tx: Tx, shikanjaId: number): Promise<void> {
  const rows = await tx
    .select({ id: shikanjaTable.id })
    .from(shikanjaTable)
    .where(eq(shikanjaTable.id, shikanjaId));
  if (rows.length === 0) throw new ProductShikanjaNotFoundError(shikanjaId);
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createProduct(
  input: CreateProductInput
): Promise<ProductRow> {
  validateItemCode(input.itemCode);
  validateProductName(input.productName);
  validateType(input.type);

  return db.transaction(async (tx) => {
    if (input.subCategoryId != null) await assertSubCategoryExists(tx, input.subCategoryId);
    if (input.shikanjaId    != null) await assertShikanjaExists(tx, input.shikanjaId);

    const rows = await tx
      .insert(productsTable)
      .values({
        itemCode:      input.itemCode.trim(),
        productName:   input.productName.trim(),
        type:          input.type,
        subCategoryId: input.subCategoryId ?? null,
        shikanjaId:    input.shikanjaId    ?? null,
      })
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updateProduct(
  id: number,
  input: UpdateProductInput
): Promise<ProductRow> {
  if (input.itemCode    !== undefined) validateItemCode(input.itemCode);
  if (input.productName !== undefined) validateProductName(input.productName);
  if (input.type        !== undefined) validateType(input.type);

  return db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    if (input.subCategoryId != null) await assertSubCategoryExists(tx, input.subCategoryId);
    if (input.shikanjaId    != null) await assertShikanjaExists(tx, input.shikanjaId);

    const rows = await tx
      .update(productsTable)
      .set({
        ...(input.itemCode      !== undefined && { itemCode:      input.itemCode.trim() }),
        ...(input.productName   !== undefined && { productName:   input.productName.trim() }),
        ...(input.type          !== undefined && { type:          input.type }),
        ...(input.subCategoryId !== undefined && { subCategoryId: input.subCategoryId }),
        ...(input.shikanjaId    !== undefined && { shikanjaId:    input.shikanjaId }),
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

    // Check all 7 referencing tables in parallel.
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

    if (counts.reduce((a, b) => a + b, 0) > 0) {
      throw new ProductInUseError(id);
    }

    await tx.delete(productsTable).where(eq(productsTable.id, id));
  });
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
  input: ListProductsInput = {}
): Promise<{ rows: ProductRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const conds = [];
  if (input.search) {
    conds.push(
      or(
        ilike(productsTable.productName, `%${input.search}%`),
        ilike(productsTable.itemCode,    `%${input.search}%`)
      )!
    );
  }
  if (input.type          !== undefined) conds.push(eq(productsTable.type,          input.type));
  if (input.subCategoryId !== undefined) conds.push(eq(productsTable.subCategoryId, input.subCategoryId));
  if (input.shikanjaId    !== undefined) conds.push(eq(productsTable.shikanjaId,    input.shikanjaId));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(productsTable).where(where)
      .then((r) => r[0]?.total ?? 0),
    db.select().from(productsTable)
      .where(where)
      .orderBy(asc(productsTable.productName), asc(productsTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
