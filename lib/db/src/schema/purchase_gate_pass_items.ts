import { pgTable, serial, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { purchaseGatePassesTable } from "./purchase_gate_passes";
import { productsTable } from "./products";

export const purchaseGatePassItemsTable = pgTable("purchase_gate_pass_items", {
  id: serial("id").primaryKey(),

  // Architecture decision AD-14: parent FK — NOT NULL, ON DELETE CASCADE.
  // Each item row belongs to exactly one Purchase Gate Pass.
  // Deleting a Purchase Gate Pass removes all its item rows.
  purchaseGatePassId: integer("purchase_gate_pass_id")
    .notNull()
    .references(() => purchaseGatePassesTable.id, { onDelete: "cascade" }),

  // Architecture decision AD-15: product FK — NOT NULL, ON DELETE RESTRICT.
  // Each item row references exactly one product from the Products master.
  // A product cannot be deleted while it has transaction item rows referencing it.
  // Product name is never stored here — always loaded through this relationship.
  // UI supports searching by Product Name or Product Code/ID; both resolve to product_id only.
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),

  // Planning document Section 2.2 Main Fields: "Gate Pass Quantity"
  // "Ye supplier ke Gate Pass par likhi hui original quantity hogi."
  // Architecture decision AD-02: numeric(10,3) — covers whole units (Set/Suit)
  // and fractional Guz (Than) uniformly.
  qty: numeric("qty", { precision: 10, scale: 3 }),

  // Gazana: per-piece Guz measurement for Than-type products.
  // Architecture decision AD-02: numeric(10,3) — measurement value, not monetary.
  gazana: numeric("gazana", { precision: 10, scale: 3 }),

  // Planning document Section 2.2 Main Fields: "Rate"
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  rate: numeric("rate", { precision: 12, scale: 2 }),

  // Planning document Section 2.2 Main Fields: "Received Quantity"
  // "Ye warehouse mein physically receive hone wali actual quantity hogi."
  // Architecture decision AD-02: numeric(10,3).
  receivedQty: numeric("received_qty", { precision: 10, scale: 3 }),

  // Pending Quantity: architecture decision AD-19 REJECTED.
  // Always computed at runtime as: qty - received_qty. No stored column.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_pgp_items_gate_pass").on(table.purchaseGatePassId),
  index("idx_pgp_items_product").on(table.productId),
]);

export const insertPurchaseGatePassItemSchema = createInsertSchema(purchaseGatePassItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseGatePassItem = z.infer<typeof insertPurchaseGatePassItemSchema>;
export type PurchaseGatePassItem = typeof purchaseGatePassItemsTable.$inferSelect;
