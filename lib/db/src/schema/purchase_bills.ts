import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseBillsTable = pgTable("purchase_bills", {
  id: serial("id").primaryKey(),

  // Planning document Section 3.3: "Har Purchase Bill ka apna unique serial number hoga."
  // Example: PB0001, PB0002, PB0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // TODO: Planning document does NOT explicitly define a unique constraint on bill_number.
  // Constraint will be finalized after architecture approval.
  // TODO: Auto-generation logic (reading from number_series, assigning next number,
  // updating counter) is business logic — will be implemented after architecture is finalized.
  billNumber: text("bill_number").notNull(),

  // Planning document Section 3.3 Main Fields: "Bill Date"
  // TODO: Planning document does NOT define the storage datatype for Bill Date
  // (date vs timestamp). Datatype will be finalized after architecture approval.
  billDate: text("bill_date").notNull(),

  // Planning document Section 3.3 Main Fields: "Purchase Party"
  // TODO: purchase_party_id foreign key to purchase_parties table will be added after
  // the complete database relationship architecture is finalized and approved.

  // Planning document Section 3.3 Main Fields: "Supplier Bill Number"
  supplierBillNumber: text("supplier_bill_number"),

  // Planning document Section 3.3 Main Fields: "Gate Pass Selection"
  // "Purchase Bill banate waqt user Purchase GP Number select karega."
  // TODO: Gate pass reference (purchase_gate_pass_id) will be added after the complete
  // database relationship architecture is finalized and approved.
  // NOTE: Planning document supports flexible billing — one bill can link to multiple
  // gate passes and vice versa. This relationship structure will be finalized during
  // architecture review.

  // Planning document Section 3.3 Main Fields: "Lot Number"
  // "Lot Number Purchase GP aur Purchase Bill dono mein common hoga."
  lotNumber: text("lot_number"),

  // Planning document Section 3.3 Main Fields: "Bill Amount"
  // TODO: Planning document does NOT define the datatype for Bill Amount
  // (numeric precision/scale not specified). Datatype will be finalized after
  // architecture approval.

  // Planning document Section 3.3 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Planning document Section 3.3 Main Fields: "Product Details (Auto Load)"
  // "Gate Pass select karte hi software automatically Product Name, Quantity,
  // Lot Number load kar dega."
  // TODO: Product detail line items require a child table (purchase_bill_items).
  // Child table will be implemented after the complete database architecture —
  // including product relationships, quantity datatypes, and rate fields — is
  // finalized and approved.

  // TODO: Ledger update logic — "Purchase Bill Save hote hi Purchase Party ke Ledger
  // mein Purchase Amount automatically update ho jayegi." — is business logic and will
  // be implemented after the Ledger table and architecture are finalized.

  // TODO: Linked Documents (linked Purchase GP serial numbers) will be implemented after
  // the complete relationship architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPurchaseBillSchema = createInsertSchema(purchaseBillsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseBill = z.infer<typeof insertPurchaseBillSchema>;
export type PurchaseBill = typeof purchaseBillsTable.$inferSelect;
