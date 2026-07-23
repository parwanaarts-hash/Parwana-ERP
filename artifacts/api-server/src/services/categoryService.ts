/**
 * Category Service
 *
 * Master-data CRUD for the categories table.
 *
 * Two-level hierarchy (per planning document / architecture decision AD-10):
 *   Main Category  — parentId IS NULL  (e.g. Summer, Winter)
 *   Sub-Category   — parentId IS NOT NULL (e.g. Lawn, Khaddar)
 *
 * Products reference Sub-Categories via products.sub_category_id.
 *
 * Delete protection:
 *   - A Main Category cannot be deleted while it has Sub-Categories.
 *   - A Sub-Category cannot be deleted while any product references it.
 */

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { categoriesTable, productsTable } from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CategoryRow = typeof categoriesTable.$inferSelect;

export interface CreateCategoryInput {
  name:      string;
  /** Omit or pass null to create a Main Category. */
  parentId?: number | null;
}

export interface UpdateCategoryInput {
  name?:     string;
  parentId?: number | null;
}

export interface ListCategoriesInput {
  /** When true, return only Main Categories (parentId IS NULL). */
  topLevelOnly?: boolean;
  /** Filter Sub-Categories belonging to a specific parent. */
  parentId?:     number;
  limit?:        number;
  offset?:       number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CategoryNotFoundError extends Error {
  constructor(id: number) {
    super(`Category not found: id=${id}`);
    this.name = "CategoryNotFoundError";
  }
}

export class CategoryParentNotFoundError extends Error {
  constructor(parentId: number) {
    super(`Parent Category not found: id=${parentId}`);
    this.name = "CategoryParentNotFoundError";
  }
}

export class CategoryInUseError extends Error {
  constructor(id: number, reason: string) {
    super(`Category id=${id} cannot be deleted: ${reason}`);
    this.name = "CategoryInUseError";
  }
}

export class CategoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryValidationError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new CategoryValidationError("name is required and cannot be blank.");
  }
  if (name.trim().length > 255) {
    throw new CategoryValidationError("name cannot exceed 255 characters.");
  }
}

async function fetchLocked(tx: Tx, id: number): Promise<CategoryRow> {
  const rows = await tx
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, id))
    .for("update");
  if (rows.length === 0) throw new CategoryNotFoundError(id);
  return rows[0]!;
}

async function assertParentExists(tx: Tx, parentId: number): Promise<void> {
  const rows = await tx
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, parentId));
  if (rows.length === 0) throw new CategoryParentNotFoundError(parentId);
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createCategory(
  input: CreateCategoryInput
): Promise<CategoryRow> {
  validateName(input.name);

  return db.transaction(async (tx) => {
    if (input.parentId != null) {
      await assertParentExists(tx, input.parentId);
    }

    const rows = await tx
      .insert(categoriesTable)
      .values({
        name:     input.name.trim(),
        parentId: input.parentId ?? null,
      })
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updateCategory(
  id: number,
  input: UpdateCategoryInput
): Promise<CategoryRow> {
  if (input.name !== undefined) validateName(input.name);

  return db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    if (input.parentId != null) {
      if (input.parentId === id) {
        throw new CategoryValidationError("A category cannot be its own parent.");
      }
      await assertParentExists(tx, input.parentId);
    }

    const rows = await tx
      .update(categoriesTable)
      .set({
        ...(input.name     !== undefined && { name: input.name.trim() }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        updatedAt: new Date(),
      })
      .where(eq(categoriesTable.id, id))
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteCategory(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const category = await fetchLocked(tx, id);

    // Main Category: cannot delete while Sub-Categories exist.
    if (category.parentId === null) {
      const childCount = await tx
        .select({ n: count() })
        .from(categoriesTable)
        .where(eq(categoriesTable.parentId, id))
        .then((r) => Number(r[0]?.n ?? 0));

      if (childCount > 0) {
        throw new CategoryInUseError(
          id,
          `it has ${childCount} sub-categor${childCount === 1 ? "y" : "ies"}. Remove them first.`
        );
      }
    }

    // Sub-Category: cannot delete while products reference it.
    const productCount = await tx
      .select({ n: count() })
      .from(productsTable)
      .where(eq(productsTable.subCategoryId, id))
      .then((r) => Number(r[0]?.n ?? 0));

    if (productCount > 0) {
      throw new CategoryInUseError(
        id,
        `${productCount} product${productCount === 1 ? " references" : "s reference"} it. Re-assign them first.`
      );
    }

    await tx.delete(categoriesTable).where(eq(categoriesTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function getCategory(id: number): Promise<CategoryRow | null> {
  const rows = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, id));
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listCategories(
  input: ListCategoriesInput = {}
): Promise<{ rows: CategoryRow[]; total: number }> {
  const limit  = input.limit  ?? 100;
  const offset = input.offset ?? 0;

  let where;
  if (input.topLevelOnly) {
    where = isNull(categoriesTable.parentId);
  } else if (input.parentId !== undefined) {
    where = eq(categoriesTable.parentId, input.parentId);
  }

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(categoriesTable).where(where)
      .then((r) => r[0]?.total ?? 0),
    db.select().from(categoriesTable)
      .where(where)
      .orderBy(desc(categoriesTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
