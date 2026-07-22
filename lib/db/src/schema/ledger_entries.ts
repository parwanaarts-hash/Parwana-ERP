import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.10: Ledger belongs to a specific party (Purchase or Sale).
  // TODO: Party reference will be added after the complete database relationship architecture
  // is finalized and approved. Planning document supports ledger search for both Purchase
  // Parties and Sale Parties — the polymorphic relationship structure must be defined first.

  // Planning document Section 3.10 Main Fields: "Date"
  // TODO: Planning document does NOT define the storage datatype for Date
  // (date vs timestamp). Datatype will be finalized after architecture approval.
  date: text("date").notNull(),

  // Planning document Section 3.10 Main Fields: "Description"
  description: text("description").notNull(),

  // Planning document Section 3.10 Main Fields: "Ref No (Bill/Payment)"
  // Stores the formatted document reference number (e.g. PB0001, PR0001, SB0002).
  refNo: text("ref_no"),

  // Planning document Section 3.10 Main Fields: "Debit"
  // TODO: Planning document does NOT define the datatype for Debit
  // (numeric precision/scale not specified). Datatype will be finalized after
  // architecture approval.

  // Planning document Section 3.10 Main Fields: "Credit"
  // TODO: Planning document does NOT define the datatype for Credit
  // (numeric precision/scale not specified). Datatype will be finalized after
  // architecture approval.

  // Planning document Section 3.10 Main Fields: "Balance"
  // TODO: Planning document does NOT define whether Balance is stored as a column or
  // computed as a running total at query time. Storage approach and datatype will be
  // finalized after architecture approval.

  // TODO: Ledger posting logic — entries are auto-created when Bills and Payments are
  // saved (Sections 3.3, 3.4, 3.5, 3.6, 3.7). This is business logic and will be
  // implemented after architecture is finalized.

  // TODO: "View Linked Document" — clicking Ref No opens the related Bill or Gate Pass
  // popup. This is application-layer logic and will be implemented after the complete
  // relationship architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
