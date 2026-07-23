/**
 * Shikanja Service
 *
 * Master-data CRUD for the shikanja table.
 * Shikanja is an internal organisational unit used to group products.
 *
 * Delete protection: a shikanja row cannot be deleted while any product
 * references it via products.shikanja_id.
 */

import { count, desc, eq, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import { productsTable, shikanjaTable } from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShikanjaRow = typeof shikanjaTable.$inferSelect;

export interface CreateShikanjaInput {
  name: string;
}

export interface UpdateShikanjaInput {
  name?: string;
}

export interface ListShikanjaInput {
  search?: string;
  limit?:  number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ShikanjaNotFoundError extends Error {
  constructor(id: number) {
    super(`Shikanja not found: id=${id}`);
    this.name = "ShikanjaNotFoundError";
  }
}

export class ShikanjaInUseError extends Error {
  constructor(id: number) {
    super(
      `Shikanja id=${id} cannot be deleted because one or more products reference it.`
    );
    this.name = "ShikanjaInUseError";
  }
}

export class ShikanjaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShikanjaValidationError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ShikanjaValidationError("name is required and cannot be blank.");
  }
  if (name.trim().length > 255) {
    throw new ShikanjaValidationError("name cannot exceed 255 characters.");
  }
}

async function fetchLocked(tx: Tx, id: number): Promise<ShikanjaRow> {
  const rows = await tx
    .select()
    .from(shikanjaTable)
    .where(eq(shikanjaTable.id, id))
    .for("update");
  if (rows.length === 0) throw new ShikanjaNotFoundError(id);
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createShikanja(
  input: CreateShikanjaInput
): Promise<ShikanjaRow> {
  validateName(input.name);

  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(shikanjaTable)
      .values({ name: input.name.trim() })
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updateShikanja(
  id: number,
  input: UpdateShikanjaInput
): Promise<ShikanjaRow> {
  if (input.name !== undefined) validateName(input.name);

  return db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    const rows = await tx
      .update(shikanjaTable)
      .set({
        ...(input.name !== undefined && { name: input.name.trim() }),
        updatedAt: new Date(),
      })
      .where(eq(shikanjaTable.id, id))
      .returning();
    return rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteShikanja(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await fetchLocked(tx, id);

    const productCount = await tx
      .select({ n: count() })
      .from(productsTable)
      .where(eq(productsTable.shikanjaId, id))
      .then((r) => Number(r[0]?.n ?? 0));

    if (productCount > 0) {
      throw new ShikanjaInUseError(id);
    }

    await tx.delete(shikanjaTable).where(eq(shikanjaTable.id, id));
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function getShikanja(id: number): Promise<ShikanjaRow | null> {
  const rows = await db
    .select()
    .from(shikanjaTable)
    .where(eq(shikanjaTable.id, id));
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listShikanja(
  input: ListShikanjaInput = {}
): Promise<{ rows: ShikanjaRow[]; total: number }> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  const where = input.search
    ? ilike(shikanjaTable.name, `%${input.search}%`)
    : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(shikanjaTable).where(where)
      .then((r) => r[0]?.total ?? 0),
    db.select().from(shikanjaTable)
      .where(where)
      .orderBy(desc(shikanjaTable.id))
      .limit(limit)
      .offset(offset),
  ]);

  return { rows, total: countResult };
}
