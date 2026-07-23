import { pgTable, serial, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { saleGatePassesTable } from "./sale_gate_passes";
import { productsTable } from "./products";

export const saleGatePassItemsTable = pgTable("sale_gate_pass_items", {
  id: serial("id").primaryKey(),

  // Architecture decision AD-14: parent FK — NOT NULL, ON DELETE CASCADE.
  // Each item row belongs to exactly one Sale Gate Pass.
  // Deleting a Sale Gate Pass removes all its item rows.
  saleGatePassId: integer("sale_gate_pass_id")
    .notNull()
    .references(() => saleGatePassesTable.id, { onDelete: "cascade" }),

  // Architecture decision AD-15: product FK — NOT NULL, ON DELETE RESTRICT.
  // Each item row references exactly one product from the Products master.
  // A product cannot be deleted while it has transaction item rows referencing it.
  // Product name is never stored here — always loaded through this relationship.
  // UI supports searching by Product Name or Product Code/ID; both resolve to product_id only.
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),

  // Planning document Section 2.3 Main Fields: "Quantity"
  // "User sirf dispatch hone wali actual Quantity enter karega."
  // Architecture decision AD-02: numeric(10,3) — covers whole units (Set/Suit)
  // and fractional Guz (Than) uniformly.
  qty: numeric("qty", { precision: 10, scale: 3 }),

  // Gazana: per-piece Guz measurement for Than-type products.
  // Architecture decision AD-02: numeric(10,3) — measurement value, not monetary.
  gazana: numeric("gazana", { precision: 10, scale: 3 }),

  // Base rate for the item.
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  rate: numeric("rate", { precision: 12, scale: 2 }),

  // Final negotiated/calculated rate applied to this line item.
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  finalRate: numeric("final_rate", { precision: 12, scale: 2 }),

  // Line item total amount.
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  total: numeric("total", { precision: 12, scale: 2 }),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_sgp_items_gate_pass").on(table.saleGatePassId),
  index("idx_sgp_items_product").on(table.productId),
]);

export const insertSaleGatePassItemSchema = createInsertSchema(saleGatePassItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSaleGatePassItem = z.infer<typeof insertSaleGatePassItemSchema>;
export type SaleGatePassItem = typeof saleGatePassItemsTable.$inferSelect;
