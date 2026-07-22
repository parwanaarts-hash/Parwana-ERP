import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseGatePassItemsTable = pgTable("purchase_gate_pass_items", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.2: Each item row belongs to a parent gate pass header.
  // Column is integer — consistent with all primary keys in this project (serial = integer).
  // TODO: Foreign key constraint to purchase_gate_passes table will be added after the
  // complete database relationship architecture is finalized and approved.
  purchaseGatePassId: integer("purchase_gate_pass_id").notNull(),

  // Planning document Section 2.2 Main Fields: "Product"
  // Column is integer — consistent with all primary keys in this project (serial = integer).
  // TODO: Foreign key constraint to products table will be added after the complete
  // database relationship architecture is finalized and approved.
  productId: integer("product_id").notNull(),

  // Planning document Section 2.2 Main Fields: "Quantity" / "Gate Pass Quantity"
  // "Ye supplier ke Gate Pass par likhi hui original quantity hogi."
  // TODO: Planning document does NOT define the datatype for Gate Pass Quantity
  // (integer vs decimal — needed for Guz measurements). Datatype will be finalized
  // after architecture approval.

  // Planning document Section 2.2 Main Fields: "Received Quantity"
  // "Ye warehouse mein physically receive hone wali actual quantity hogi."
  // TODO: Planning document does NOT define the datatype for Received Quantity
  // (integer vs decimal — needed for Guz measurements). Datatype will be finalized
  // after architecture approval.

  // Planning document Section 2.2: "Pending Quantity"
  // "Software automatically Pending Quantity calculate karega."
  // TODO: Planning document defines Pending Quantity as auto-calculated
  // (Gate Pass Qty - Received Qty). Whether it should be stored as a column or always
  // computed at query time is not defined. Will be finalized after architecture approval.

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
