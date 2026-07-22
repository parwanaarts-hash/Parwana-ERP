import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.1: Category names are explicitly defined.
  // Main Categories: Summer, Winter
  // Sub Categories: e.g. Lawn, Cotton, Digital Print (under Summer),
  // Khaddar, Linen, Marina (under Winter)
  name: text("name").notNull(),

  // TODO: Planning document defines a 2-level hierarchy (Main Category → Sub Categories)
  // but does NOT explicitly define the implementation of this relationship.
  // Options include: self-referencing parent_id column, a separate table for each level,
  // or another approach. The relationship implementation will be added after the complete
  // database architecture is finalized and approved.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
