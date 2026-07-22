import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const returnGatePassesTable = pgTable("return_gate_passes", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.4: "Har Return Gate Pass ka apna unique serial number hoga."
  // Example: RGP0001, RGP0002, RGP0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // TODO: Planning document does NOT explicitly define a unique constraint on gp_number.
  // Constraint will be finalized after architecture approval.
  // TODO: Auto-generation logic (reading from number_series, assigning next number,
  // updating counter) is business logic — will be implemented after architecture is finalized.
  gpNumber: text("gp_number").notNull(),

  // Planning document Section 2.4 Main Fields: "Date"
  // TODO: Planning document does NOT define the storage datatype for Date (date vs timestamp).
  // Datatype will be finalized after architecture approval.
  date: text("date").notNull(),

  // Planning document Section 2.4 Main Fields: "Sale Party"
  // TODO: sale_party_id foreign key to sale_parties table will be added after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 2.4 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Planning document Section 2.4 Main Fields: "Product", "Quantity", "Fresh", "B Mall"
  // "Har Product ke samne 2 Check Boxes honge — Fresh / B Mall"
  // The child table return_gate_pass_items already exists. Pending architecture decisions
  // within that table (product_id FK, quantity datatype, Fresh/B Mall storage format)
  // will be finalized after the complete database architecture is approved.

  // TODO: Stock update logic — "Sirf Fresh Return Stock mein add hoga. B Mall kabhi bhi
  // Stock increase nahi karega." — is business logic and will be implemented after
  // architecture is finalized.

  // TODO: ERP Integration — "Return Gate Pass banne ke baad ERP Module mein Return Bill
  // banega." — will be implemented after Return Bill table and relationship architecture
  // are finalized.

  // TODO: Linked Documents (linked Return Bill serial number) will be implemented after
  // the Return Bill table and its relationship architecture are finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReturnGatePassSchema = createInsertSchema(returnGatePassesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReturnGatePass = z.infer<typeof insertReturnGatePassSchema>;
export type ReturnGatePass = typeof returnGatePassesTable.$inferSelect;
