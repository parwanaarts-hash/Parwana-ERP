import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesBillsTable = pgTable("sales_bills", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.4: "Har Sales Bill ka apna unique serial number hoga."
  // Example: SB0001, SB0002, SB0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // TODO: Planning document does NOT explicitly define a unique constraint on bill_number.
  // Constraint will be finalized after architecture approval.
  // TODO: Auto-generation logic (reading from number_series, assigning next number,
  // updating counter) is business logic — will be implemented after architecture is finalized.
  billNumber: text("bill_number").notNull(),

  // Planning document Section 3.4 Main Fields: "Bill Date"
  // TODO: Planning document does NOT define the storage datatype for Bill Date
  // (date vs timestamp). Datatype will be finalized after architecture approval.
  billDate: text("bill_date").notNull(),

  // Planning document Section 3.4 Main Fields: "Sale Party"
  // TODO: sale_party_id foreign key to sale_parties table will be added after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 3.4 Main Fields: "Bill Type (Cash / Credit)"
  // "Bill banate waqt user Bill Type select karega — Cash / Credit."
  // TODO: Planning document does NOT define the storage format for Bill Type
  // (enum, plain text, or boolean). Storage format will be finalized after architecture approval.

  // Planning document Section 3.4 Main Fields: "Sale Gate Pass Number"
  // "User Sale Gate Pass Number select karega. Software automatically us Gate Pass ki
  // tamam Product Details load kar dega."
  // TODO: sale_gate_pass_id reference will be added after the complete database
  // relationship architecture is finalized and approved.

  // Planning document Section 3.4 Main Fields: "Cash Payment"
  // TODO: Planning document does NOT define the datatype for Cash Payment
  // (numeric precision/scale not specified). Datatype will be finalized after architecture approval.

  // Planning document Section 3.4 Main Fields: "Bank Payment"
  // TODO: Planning document does NOT define the datatype for Bank Payment
  // (numeric precision/scale not specified). Datatype will be finalized after architecture approval.

  // Planning document Section 3.4 Main Fields: "Bill Amount"
  // TODO: Planning document does NOT define the datatype for Bill Amount
  // (numeric precision/scale not specified). Datatype will be finalized after architecture approval.

  // Planning document Section 3.4 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Planning document Section 3.4 Main Fields: "Product Details (Auto Load)"
  // "Gate Pass select karte hi software automatically Product Details load kar dega."
  // TODO: Product detail line items require a child table (sales_bill_items).
  // Child table will be implemented after the complete database architecture —
  // including product relationships, quantity datatypes, and rate/amount fields —
  // is finalized and approved.

  // TODO: Ledger update logic — "Sales Bill Save hote hi Customer ka Ledger automatically
  // update ho jayega." — is business logic and will be implemented after the Ledger table
  // and architecture are finalized.

  // TODO: Linked Documents (linked Sale Gate Pass serial number) will be implemented after
  // the complete relationship architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSalesBillSchema = createInsertSchema(salesBillsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesBill = z.infer<typeof insertSalesBillSchema>;
export type SalesBill = typeof salesBillsTable.$inferSelect;
