import { pgTable, serial, integer, text, date, numeric, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salePartiesTable } from "./sale_parties";

export const salesBillsTable = pgTable("sales_bills", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.4: "Har Sales Bill ka apna unique serial number hoga."
  // Example: SB0001, SB0002, SB0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // Architecture decision AD-18: UNIQUE constraint — no two bills share a number.
  // Architecture decision AD-09: auto-generation via number_series table (business logic,
  // implemented in backend phase).
  billNumber: text("bill_number").notNull().unique(),

  // Architecture decision AD-01: date type. Calendar date only — no time-of-day required.
  billDate: date("bill_date").notNull(),

  // Architecture decision AD-13: party FK — NOT NULL, ON DELETE RESTRICT.
  // Every Sales Bill must belong to a Sale Party.
  // A Sale Party cannot be deleted while it has bill records.
  salePartyId: integer("sale_party_id")
    .notNull()
    .references(() => salePartiesTable.id, { onDelete: "restrict" }),

  // Planning document Section 3.4 Main Fields: "Bill Type (Cash / Credit)"
  // Architecture decision AD-07: stored as text with CHECK constraint.
  // Allowed values: 'Cash', 'Credit' — exactly as defined in the planning document.
  // Nullable: bill type selected at entry time.
  billType: text("bill_type"),

  // Planning document Section 3.4 Main Fields: "Cash Payment"
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  // Nullable: only present when cash payment is received at billing.
  cashPayment: numeric("cash_payment", { precision: 12, scale: 2 }),

  // Planning document Section 3.4 Main Fields: "Bank Payment"
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  // Nullable: only present when bank payment is received at billing.
  bankPayment: numeric("bank_payment", { precision: 12, scale: 2 }),

  // Planning document Section 3.4 Main Fields: "Bill Amount"
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  billAmount: numeric("bill_amount", { precision: 12, scale: 2 }),

  // Planning document Section 3.4 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Gate Pass relationship: sale_gate_passes.sales_bill_id is the FK side
  // (AD-16 — Gate Pass stores the bill reference, not the other way around).
  // To find all Gate Passes linked to this bill: query sale_gate_passes WHERE sales_bill_id = this.id

  // TODO: Ledger update logic — "Sales Bill Save hote hi Customer ka Ledger automatically
  // update ho jayega." — business logic, backend phase.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-07: bill_type must be one of the two defined bill types.
  check("sales_bills_bill_type_check", sql`${table.billType} IN ('Cash', 'Credit')`),

  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_sb_party").on(table.salePartyId),
  // Architecture decision AD-22: date-range index.
  index("idx_sb_date").on(table.billDate),
]);

export const insertSalesBillSchema = createInsertSchema(salesBillsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesBill = z.infer<typeof insertSalesBillSchema>;
export type SalesBill = typeof salesBillsTable.$inferSelect;
