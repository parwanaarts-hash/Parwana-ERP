import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentPaidsTable = pgTable("payment_paids", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.7 Main Fields: "Voucher No"
  // Example format: PP0001, PP0002, PP0003 (based on number_series prefix system).
  // Stored as text to hold the full formatted serial (prefix + number).
  // TODO: Planning document does NOT explicitly define a unique constraint on this field.
  // Constraint will be finalized after architecture approval.
  // TODO: Auto-generation logic (reading from number_series, assigning next number,
  // updating counter) is business logic — will be implemented after architecture is finalized.
  ppNumber: text("pp_number").notNull(),

  // Planning document Section 3.7 Main Fields: "Date"
  // TODO: Planning document does NOT define the storage datatype for Date
  // (date vs timestamp). Datatype will be finalized after architecture approval.
  date: text("date").notNull(),

  // Planning document Section 3.7 Main Fields: "Purchase Party"
  // TODO: purchase_party_id foreign key to purchase_parties table will be added after
  // the complete database relationship architecture is finalized and approved.

  // Planning document Section 3.7 Main Fields: "Payment Mode (Cash/Bank)"
  // TODO: Planning document does NOT define the storage format for Payment Mode
  // (enum, plain text, or boolean). Storage format will be finalized after architecture approval.

  // Planning document Section 3.7 Main Fields: "Amount"
  // TODO: Planning document does NOT define the datatype for Amount
  // (numeric precision/scale not specified). Datatype will be finalized after
  // architecture approval.

  // Planning document Section 3.7 Main Fields: "Remarks"
  remarks: text("remarks"),

  // TODO: Ledger update logic — Payment Paid Save hote hi Purchase Party ka Ledger
  // automatically update ho jayega. Will be implemented after the Ledger table and
  // architecture are finalized.

  // TODO: Linked Documents (linked Purchase Bill serial numbers this payment is applied
  // against) will be implemented after the complete relationship architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPaymentPaidSchema = createInsertSchema(paymentPaidsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentPaid = z.infer<typeof insertPaymentPaidSchema>;
export type PaymentPaid = typeof paymentPaidsTable.$inferSelect;
