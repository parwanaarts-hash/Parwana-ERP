import { pgTable, serial, integer, text, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.1: Category names are explicitly defined.
  // Main Categories: Summer, Winter
  // Sub Categories: e.g. Lawn, Cotton, Digital Print (under Summer),
  // Khaddar, Linen, Marina (under Winter)
  name: text("name").notNull(),

  // Architecture decision AD-10: self-referencing parent_id for 2-level hierarchy.
  // NULL = Main Category (Summer, Winter).
  // Non-null = Sub-Category (Lawn, Cotton, Khaddar, etc.) — points to its Main Category.
  // ON DELETE RESTRICT: a Main Category cannot be deleted while it has Sub-Categories.
  // Prevents Sub-Categories from being silently orphaned or incorrectly promoted.
  // Callback form required for self-referencing FK (lazy evaluation — prevents
  // TypeScript variable-before-declaration error).
  parentId: integer("parent_id").references((): AnyPgColumn => categoriesTable.id, { onDelete: "restrict" }),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
