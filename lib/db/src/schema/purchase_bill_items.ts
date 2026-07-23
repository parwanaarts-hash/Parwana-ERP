import { pgTable, serial, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { purchaseBillsTable } from "./purchase_bills";
import { productsTable } from "./products";

export const purchaseBillItemsTable = pgTable("purchase_bill_items", {
  id: serial("id").primaryKey(),

  // Architecture decision AD-14: parent FK — NOT NULL, ON DELETE CASCADE.
  // Each item row belongs to exactly one Purchase Bill.
  // Deleting a Purchase Bill removes all its item rows.
  purchaseBillId: integer("purchase_bill_id")
    .notNull()
    .references(() => purchaseBillsTable.id, { onDelete: "cascade" }),

  // Architecture decision AD-15: product FK — NOT NULL, ON DELETE RESTRICT.
  // Each item row references exactly one product from the Products master.
  // A product cannot be deleted while it has transaction item rows referencing it.
  // Product name is never stored here — always loaded through this relationship.
  // UI supports searching by Product Name or Product Code/ID; both resolve to product_id only.
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),

  // Planning document Section 3.3 Main Fields: "Product Details (Auto Load)"
  // Auto-loaded fields include: Product Name, Quantity, Lot Number.
  // Architecture decision AD-02: numeric(10,3) — covers whole units (Set/Suit)
  // and fractional Guz (Than) uniformly.
  qty: numeric("qty", { precision: 10, scale: 3 }),

  // AD-21: item-level rate and amount fields for Purchase Bill Items are not yet approved.
  // Bill Amount is defined at the header level (purchase_bills.bill_amount).
  // Do NOT add rate, final_rate, or total without explicit approval.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_pb_items_bill").on(table.purchaseBillId),
  index("idx_pb_items_product").on(table.productId),
]);

export const insertPurchaseBillItemSchema = createInsertSchema(purchaseBillItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseBillItem = z.infer<typeof insertPurchaseBillItemSchema>;
export type PurchaseBillItem = typeof purchaseBillItemsTable.$inferSelect;
