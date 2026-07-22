import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseGatePassesTable = pgTable("purchase_gate_passes", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.2: "Har Purchase Gate Pass ka apna unique serial number hoga."
  // Example: PGP0001, PGP0002, PGP0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // TODO: Planning document does NOT explicitly define a unique constraint on gp_number.
  // Constraint will be finalized after architecture approval.
  // TODO: Auto-generation logic (reading from number_series, assigning next number, updating
  // counter) is business logic — will be implemented after architecture is finalized.
  gpNumber: text("gp_number").notNull(),

  // Planning document Section 2.2 Main Fields: "Date"
  // TODO: Planning document does NOT define the storage datatype for Date (date vs timestamp).
  // Datatype will be finalized after architecture approval.
  date: text("date").notNull(),

  // Planning document Section 2.2 Main Fields: "Purchase Party"
  // TODO: purchase_party_id foreign key will be added after the complete database
  // relationship architecture is finalized and approved.

  // Planning document Section 2.2: "Har Purchase Gate Pass mein Lot Number enter karna
  // lazmi hoga. Ye Lot Number supplier ke Gate Pass par bhi hoga."
  lotNumber: text("lot_number").notNull(),

  // Planning document Section 2.2 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Planning document Section 2.2 Main Fields: "Product", "Quantity", "Gate Pass Quantity",
  // "Received Quantity", "Pending Quantity"
  // TODO: A Purchase Gate Pass contains multiple product line items (Product, Gate Pass
  // Quantity, Received Quantity, Pending Quantity per product). This requires a child/detail
  // table (e.g. purchase_gate_pass_items). Child table will be implemented after the complete
  // database architecture — including product relationships and quantity datatypes — is
  // finalized and approved.

  // TODO: Pending Quantity is explicitly defined as auto-calculated by software:
  // "Software automatically Pending Quantity calculate karega (Gate Pass Qty - Received Qty)."
  // Whether it is stored or always computed will be decided after architecture approval.

  // TODO: Stock update logic — "Sirf Received Quantity Stock mein add hogi" — is business
  // logic and will be implemented after architecture is finalized.

  // TODO: Linked Documents (linked Purchase Bill serial numbers) will be implemented after
  // the Purchase Bill table and its relationship architecture are finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPurchaseGatePassSchema = createInsertSchema(purchaseGatePassesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseGatePass = z.infer<typeof insertPurchaseGatePassSchema>;
export type PurchaseGatePass = typeof purchaseGatePassesTable.$inferSelect;
