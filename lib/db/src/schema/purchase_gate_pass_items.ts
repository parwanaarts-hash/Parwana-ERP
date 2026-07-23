import { pgTable, serial, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseGatePassItemsTable = pgTable("purchase_gate_pass_items", {
  id: serial("id").primaryKey(),

  // TODO: Parent relationship (purchase_gate_pass_id) will be implemented after the
  // complete database relationship architecture is finalized and approved.

  // TODO: Product relationship (product_id) will be implemented after the complete
  // database relationship architecture is finalized and approved.

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
  // Pending Quantity is always computed at runtime as: qty - received_qty.
  // No stored column.

  // TODO: Stock update logic — "Sirf Received Quantity Stock mein add hogi. Gate Pass
  // Quantity kabhi Stock increase nahi karegi." — is business logic and will be
  // implemented after architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPurchaseGatePassItemSchema = createInsertSchema(purchaseGatePassItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseGatePassItem = z.infer<typeof insertPurchaseGatePassItemSchema>;
export type PurchaseGatePassItem = typeof purchaseGatePassItemsTable.$inferSelect;
