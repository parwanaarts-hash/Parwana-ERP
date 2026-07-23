import { pgTable, serial, integer, text, date, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salePartiesTable } from "./sale_parties";

export const returnBillsTable = pgTable("return_bills", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.5: "Har Return Bill ka apna unique serial number hoga."
  // Example: RB0001, RB0002, RB0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // Architecture decision AD-18: UNIQUE constraint — no two bills share a number.
  // Architecture decision AD-09: auto-generation via number_series table (business logic,
  // implemented in backend phase).
  billNumber: text("bill_number").notNull().unique(),

  // Architecture decision AD-01: date type. Calendar date only — no time-of-day required.
  billDate: date("bill_date").notNull(),

  // Architecture decision AD-13: party FK — NOT NULL, ON DELETE RESTRICT.
  // Every Return Bill must belong to a Sale Party (returns are from customers).
  // A Sale Party cannot be deleted while it has return bill records.
  salePartyId: integer("sale_party_id")
    .notNull()
    .references(() => salePartiesTable.id, { onDelete: "restrict" }),

  // Planning document Section 3.5 Main Fields: "Bill Amount"
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  billAmount: numeric("bill_amount", { precision: 12, scale: 2 }),

  // Planning document Section 3.5 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Gate Pass relationship: return_gate_passes.return_bill_id is the FK side
  // (AD-16 — Gate Pass stores the bill reference, not the other way around).
  // To find all Gate Passes linked to this bill: query return_gate_passes WHERE return_bill_id = this.id

  // TODO: Ledger update logic — "Return Bill Save hote hi Customer ka Ledger automatically
  // update ho jayega." — business logic, backend phase.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_rb_party").on(table.salePartyId),
  // Architecture decision AD-22: date-range index.
  index("idx_rb_date").on(table.billDate),
]);

export const insertReturnBillSchema = createInsertSchema(returnBillsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReturnBill = z.infer<typeof insertReturnBillSchema>;
export type ReturnBill = typeof returnBillsTable.$inferSelect;
