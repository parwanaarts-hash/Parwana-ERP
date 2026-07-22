import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const saleGatePassesTable = pgTable("sale_gate_passes", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.3: "Har Sale Gate Pass ka apna unique serial number hoga."
  // Example: SGP0001, SGP0002, SGP0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // TODO: Planning document does NOT explicitly define a unique constraint on gp_number.
  // Constraint will be finalized after architecture approval.
  // TODO: Auto-generation logic (reading from number_series, assigning next number,
  // updating counter) is business logic — will be implemented after architecture is finalized.
  gpNumber: text("gp_number").notNull(),

  // Planning document Section 2.3 Main Fields: "Date"
  // TODO: Planning document does NOT define the storage datatype for Date (date vs timestamp).
  // Datatype will be finalized after architecture approval.
  date: text("date").notNull(),

  // Planning document Section 2.3 Main Fields: "Sale Party"
  // TODO: sale_party_id foreign key to sale_parties table will be added after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 2.3 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Planning document Section 2.3 Main Fields: "Product", "Quantity"
  // The child table sale_gate_pass_items already exists. Pending architecture decisions
  // within that table (product_id FK, quantity datatype) will be finalized after the
  // complete database architecture is approved.

  // TODO: Stock update logic — "Jese hi Sale Gate Pass Save hoga, software warehouse ke
  // Stock se utni Quantity automatically minus kar dega." — is business logic and will be
  // implemented after architecture is finalized.

  // TODO: ERP Integration — "Sale Gate Pass banne ke baad uska Financial Bill ERP Module
  // ke Sales Bill Register mein banega." — will be implemented after Sales Bill table and
  // relationship architecture are finalized.

  // TODO: Linked Documents (linked Sales Bill serial number) will be implemented after
  // the Sales Bill table and its relationship architecture are finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSaleGatePassSchema = createInsertSchema(saleGatePassesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSaleGatePass = z.infer<typeof insertSaleGatePassSchema>;
export type SaleGatePass = typeof saleGatePassesTable.$inferSelect;
