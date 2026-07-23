import { pgTable, serial, text, date, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.10: Ledger belongs to a specific party (Purchase or Sale).
  // TODO: Party reference will be added after the complete database relationship architecture
  // is finalized and approved (AD-17 on HOLD). Planning document supports ledger search for
  // both Purchase Parties and Sale Parties — the polymorphic relationship structure must
  // be defined first.

  // Planning document Section 3.10 Main Fields: "Date"
  // Architecture decision AD-01: date type. Calendar date only — no time-of-day required.
  date: date("date").notNull(),

  // Planning document Section 3.10 Main Fields: "Description"
  description: text("description").notNull(),

  // Planning document Section 3.10 Main Fields: "Ref No (Bill/Payment)"
  // Stores the formatted document reference number (e.g. PB0001, PR0001, SB0002).
  // Nullable: opening balance entries may have no reference document.
  refNo: text("ref_no"),

  // Planning document Section 3.10 Main Fields: "Debit"
  // Architecture decision AD-03: numeric(12,2) for all monetary fields.
  // Nullable: credit-only entries will have debit as null.
  debit: numeric("debit", { precision: 12, scale: 2 }),

  // Planning document Section 3.10 Main Fields: "Credit"
  // Architecture decision AD-03: numeric(12,2) for all monetary fields.
  // Nullable: debit-only entries will have credit as null.
  credit: numeric("credit", { precision: 12, scale: 2 }),

  // Planning document Section 3.10 Main Fields: "Balance"
  // Architecture decision AD-20: balance stored as a column.
  // Maintained by application/business logic on every ledger entry save.
  // Formula: previous_balance + debit - credit (per ledger convention for this business).
  // Architecture decision: Financial Ledger = Party-based only.
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),

  // TODO: Ledger posting logic — entries are auto-created when Bills and Payments are
  // saved (Sections 3.3, 3.4, 3.5, 3.6, 3.7). Business logic will be implemented after
  // architecture is finalized.

  // TODO: "View Linked Document" — clicking Ref No opens the related Bill or Gate Pass
  // popup. Application-layer logic — will be implemented after relationship architecture
  // (AD-17) is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
