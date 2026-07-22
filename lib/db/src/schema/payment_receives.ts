import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentReceivesTable = pgTable("payment_receives", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.6: "Har Payment Receive ka apna unique serial number hoga."
  // Example: PR0001, PR0002, PR0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // TODO: Planning document does NOT explicitly define a unique constraint on pr_number.
  // Constraint will be finalized after architecture approval.
  // TODO: Auto-generation logic (reading from number_series, assigning next number,
  // updating counter) is business logic — will be implemented after architecture is finalized.
  prNumber: text("pr_number").notNull(),

  // Planning document Section 3.6 Main Fields: "Date"
  // TODO: Planning document does NOT define the storage datatype for Date
  // (date vs timestamp). Datatype will be finalized after architecture approval.
  date: text("date").notNull(),

  // Planning document Section 3.6 Main Fields: "Sale Party"
  // TODO: sale_party_id foreign key to sale_parties table will be added after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 3.6 Main Fields: "Payment Mode (Cash/Bank)"
  // TODO: Planning document does NOT define the storage format for Payment Mode
  // (enum, plain text, or boolean). Storage format will be finalized after architecture approval.

  // Planning document Section 3.6 Main Fields: "Amount"
  // TODO: Planning document does NOT define the datatype for Amount
  // (numeric precision/scale not specified). Datatype will be finalized after
  // architecture approval.

  // Planning document Section 3.6 Main Fields: "Remarks"
  remarks: text("remarks"),

  // TODO: Ledger update logic — Payment Receive Save hote hi Sale Party ka Ledger
  // automatically update ho jayega. Will be implemented after the Ledger table and
  // architecture are finalized.

  // TODO: Linked Documents (linked Sales Bill serial numbers this payment is applied
  // against) will be implemented after the complete relationship architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPaymentReceiveSchema = createInsertSchema(paymentReceivesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentReceive = z.infer<typeof insertPaymentReceiveSchema>;
export type PaymentReceive = typeof paymentReceivesTable.$inferSelect;
