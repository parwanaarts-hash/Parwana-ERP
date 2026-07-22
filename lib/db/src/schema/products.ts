import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  // TODO: Planning document does NOT define whether type should be constrained (enum) or
  // stored as plain text. Storage format will be finalized after architecture approval.
  type: text("type").notNull(),

  // Planning document Section 2.1 Dependencies: "categories (sub_category must exist)"
  // Product create karte waqt Sub Category select karna lazmi hai.
  // TODO: Foreign key constraint to categories table will be added after the categories
  // table is created and its architecture is finalized and approved.
  subCategoryId: integer("sub_category_id").notNull(),

  // Planning document Section 2.1 Dependencies: "shikanja (shikanja must exist)"
  // Product create karte waqt Shikanja select karna lazmi hai.
  // TODO: Foreign key constraint to shikanja table will be added after the shikanja
  // table is created and its architecture is finalized and approved.
  shikanjaId: integer("shikanja_id").notNull(),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
