import { pgTable, serial, integer, text, date, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { purchasePartiesTable } from "./purchase_parties";

export const purchaseBillsTable = pgTable("purchase_bills", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.3: "Har Purchase Bill ka apna unique serial number hoga."
  // Example: PB0001, PB0002, PB0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // Architecture decision AD-18: UNIQUE constraint — no two bills share a number.
  // Architecture decision AD-09: auto-generation via number_series table (business logic,
  // implemented in backend phase).
  billNumber: text("bill_number").notNull().unique(),

  // Architecture decision AD-01: date type. Calendar date only — no time-of-day required.
  billDate: date("bill_date").notNull(),

  // Architecture decision AD-13: party FK — NOT NULL, ON DELETE RESTRICT.
  // Every Purchase Bill must belong to a Purchase Party.
  // A Purchase Party cannot be deleted while it has bill records.
  purchasePartyId: integer("purchase_party_id")
    .notNull()
    .references(() => purchasePartiesTable.id, { onDelete: "restrict" }),

  // Planning document Section 3.3 Main Fields: "Supplier Bill Number"
  supplierBillNumber: text("supplier_bill_number"),

  // Planning document Section 3.3 Main Fields: "Lot Number"
  // "Lot Number Purchase GP aur Purchase Bill dono mein common hoga."
  lotNumber: text("lot_number"),

  // Planning document Section 3.3 Main Fields: "Bill Amount"
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  billAmount: numeric("bill_amount", { precision: 12, scale: 2 }),

  // Planning document Section 3.3 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Gate Pass relationship: purchase_gate_passes.purchase_bill_id is the FK side
  // (AD-16 — Gate Pass stores the bill reference, not the other way around).
  // To find all Gate Passes linked to this bill: query purchase_gate_passes WHERE purchase_bill_id = this.id

  // TODO: Ledger update logic — "Purchase Bill Save hote hi Purchase Party ke Ledger
  // mein Purchase Amount automatically update ho jayegi." — business logic, backend phase.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_pb_party").on(table.purchasePartyId),
  // Architecture decision AD-22: date-range index.
  index("idx_pb_date").on(table.billDate),
]);

export const insertPurchaseBillSchema = createInsertSchema(purchaseBillsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseBill = z.infer<typeof insertPurchaseBillSchema>;
export type PurchaseBill = typeof purchaseBillsTable.$inferSelect;
