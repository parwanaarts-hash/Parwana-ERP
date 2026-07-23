import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { shikanjaTable } from "./shikanja";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.1: "Har Product ka apna unique Item Code hoga"
  // Duplicate Item Codes allowed nahi hain.
  itemCode: text("item_code").notNull().unique(),

  // Planning document Section 2.5 (Product List Report): "Product Name" explicitly listed
  // as displayed information for every product.
  productName: text("product_name").notNull(),

  // Planning document Section 2.1: "Product save karte waqt uska Type select karna lazmi hoga"
  // Defined types: Set, Than, Suit
  // Architecture decision AD-04: stored as text. CHECK constraint ('Set','Than','Suit')
  // will be added during schema finalization.
  // TODO: CHECK constraint to be applied in schema finalization phase.
  type: text("type").notNull(),

  // Architecture decision AD-11: sub_category_id FK to categories table.
  // Links product to a Sub-Category row (parent_id IS NOT NULL in categories).
  // Application layer enforces that only Sub-Categories are selectable in the dropdown.
  // Nullable: planning document does not mandate category assignment at product creation.
  // ON DELETE RESTRICT: a Sub-Category cannot be deleted while products are assigned to it.
  subCategoryId: integer("sub_category_id").references(() => categoriesTable.id, { onDelete: "restrict" }),

  // Architecture decision AD-12: shikanja_id FK to shikanja table.
  // Planning document: "Product create karte waqt Shikanja dropdown se select kiya jayega."
  // Nullable: planning document does not mandate shikanja assignment at product creation.
  // ON DELETE RESTRICT: a Shikanja cannot be deleted while products are assigned to it.
  shikanjaId: integer("shikanja_id").references(() => shikanjaTable.id, { onDelete: "restrict" }),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
