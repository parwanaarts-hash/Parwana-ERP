import { pgTable, serial, integer, text, date, numeric, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salePartiesTable } from "./sale_parties";
import { purchasePartiesTable } from "./purchase_parties";

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),

  // Architecture decision AD-17: Two nullable FK columns, exactly one must be populated.
  // Financial Ledger is Party-based only — every entry belongs to either a Sale Party
  // or a Purchase Party, never both, never neither.
  // CHECK constraint below enforces this at the database level.
  // ON DELETE RESTRICT: a party cannot be deleted while it has ledger history.

  // Sale Party: ledger entries for Sales Bills, Return Bills, Payment Receives.
  salePartyId: integer("sale_party_id")
    .references(() => salePartiesTable.id, { onDelete: "restrict" }),

  // Purchase Party: ledger entries for Purchase Bills, Payment Paids.
  purchasePartyId: integer("purchase_party_id")
    .references(() => purchasePartiesTable.id, { onDelete: "restrict" }),

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
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),

  // TODO: Ledger posting logic — entries are auto-created when Bills and Payments are
  // saved (Sections 3.3, 3.4, 3.5, 3.6, 3.7). Business logic will be implemented after
  // architecture is finalized.

  // TODO: "View Linked Document" — clicking Ref No opens the related Bill or Gate Pass
  // popup. Application-layer logic — will be implemented after AD-16 is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-17: exactly ONE party FK must be populated per ledger entry.
  // Valid:   sale_party_id filled + purchase_party_id null
  // Valid:   purchase_party_id filled + sale_party_id null
  // Invalid: both null (unowned entry)
  // Invalid: both filled (ambiguous ownership)
  check(
    "ledger_party_check",
    sql`(${table.salePartyId} IS NOT NULL AND ${table.purchasePartyId} IS NULL) OR (${table.salePartyId} IS NULL AND ${table.purchasePartyId} IS NOT NULL)`
  ),
]);

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
