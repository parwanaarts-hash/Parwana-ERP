import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const returnBillsTable = pgTable("return_bills", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.5: "Har Return Bill ka apna unique serial number hoga."
  // Example: RB0001, RB0002, RB0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // TODO: Planning document does NOT explicitly define a unique constraint on bill_number.
  // Constraint will be finalized after architecture approval.
  // TODO: Auto-generation logic (reading from number_series, assigning next number,
  // updating counter) is business logic — will be implemented after architecture is finalized.
  billNumber: text("bill_number").notNull(),

  // Planning document Section 3.5 Main Fields: "Bill Date"
  // TODO: Planning document does NOT define the storage datatype for Bill Date
  // (date vs timestamp). Datatype will be finalized after architecture approval.
  billDate: text("bill_date").notNull(),

  // Planning document Section 3.5 Main Fields: "Sale Party"
  // TODO: sale_party_id foreign key to sale_parties table will be added after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 3.5 Main Fields: "Return Gate Pass Number"
  // "ERP Module mein sirf Return GP Number enter kiya jayega. Software automatically
  // us Return GP ki tamam Items load kar dega."
  // TODO: return_gate_pass_id reference will be added after the complete database
  // relationship architecture is finalized and approved.

  // Planning document Section 3.5 Main Fields: "Bill Amount"
  // TODO: Planning document does NOT define the datatype for Bill Amount
  // (numeric precision/scale not specified). Datatype will be finalized after
  // architecture approval.

  // Planning document Section 3.5 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Planning document Section 3.5 Main Fields: "Product Details (Auto Load)"
  // "Return GP Number enter karte hi software automatically tamam Items load kar dega."
  // The child table return_bill_items already exists. Pending architecture decisions
  // within that table (product_id FK, quantity datatype, amount fields) will be
  // finalized after the complete database architecture is approved.

  // TODO: Ledger update logic — "Return Bill Save hote hi Customer ka Ledger automatically
  // update ho jayega." — is business logic and will be implemented after the Ledger table
  // and architecture are finalized.

  // TODO: Linked Documents (linked Return Gate Pass serial number) will be implemented
  // after the complete relationship architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReturnBillSchema = createInsertSchema(returnBillsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReturnBill = z.infer<typeof insertReturnBillSchema>;
export type ReturnBill = typeof returnBillsTable.$inferSelect;
