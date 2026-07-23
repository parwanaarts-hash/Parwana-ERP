import { pgTable, serial, integer, text, date, numeric, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salePartiesTable } from "./sale_parties";

export const paymentReceivesTable = pgTable("payment_receives", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.6 Main Fields: "Receipt No"
  // Example format: PR0001, PR0002, PR0003 (based on number_series prefix system).
  // Stored as text to hold the full formatted serial (prefix + number).
  // Architecture decision AD-18: UNIQUE constraint — no two receipts share a number.
  // Architecture decision AD-09: auto-generation via number_series table (business logic,
  // implemented in backend phase).
  prNumber: text("pr_number").notNull().unique(),

  // Architecture decision AD-01: date type. Calendar date only — no time-of-day required.
  date: date("date").notNull(),

  // Architecture decision AD-13: party FK — NOT NULL, ON DELETE RESTRICT.
  // Every Payment Receive must belong to a Sale Party.
  // A Sale Party cannot be deleted while it has payment receive records.
  salePartyId: integer("sale_party_id")
    .notNull()
    .references(() => salePartiesTable.id, { onDelete: "restrict" }),

  // Planning document Section 3.6 Main Fields: "Payment Mode (Cash/Bank)"
  // Architecture decision AD-06: stored as text with CHECK constraint.
  // Allowed values: 'Cash', 'Bank' — exactly as defined in the planning document.
  // Nullable: payment mode selected at entry time.
  paymentMode: text("payment_mode"),

  // Planning document Section 3.6 Main Fields: "Amount"
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  amount: numeric("amount", { precision: 12, scale: 2 }),

  // Planning document Section 3.6 Main Fields: "Remarks"
  remarks: text("remarks"),

  // TODO: Ledger update logic — "Payment Receive Save hote hi Sale Party ka Ledger
  // automatically update ho jayega." — business logic, backend phase.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-06: payment_mode must be one of the two defined modes.
  check("payment_receives_mode_check", sql`${table.paymentMode} IN ('Cash', 'Bank')`),

  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_pr_party").on(table.salePartyId),
  // Architecture decision AD-22: date-range index.
  index("idx_pr_date").on(table.date),
]);

export const insertPaymentReceiveSchema = createInsertSchema(paymentReceivesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentReceive = z.infer<typeof insertPaymentReceiveSchema>;
export type PaymentReceive = typeof paymentReceivesTable.$inferSelect;
