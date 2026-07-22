import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesBillItemsTable = pgTable("sales_bill_items", {
  id: serial("id").primaryKey(),

  // TODO: Parent relationship (sales_bill_id) will be implemented after the
  // complete database relationship architecture is finalized and approved.

  // TODO: Product relationship (product_id) will be implemented after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 3.4 Main Fields: "Product Details (Auto Load)"
  // Auto-loaded from Sale Gate Pass: Product Name, Quantity.
  // TODO: Planning document does NOT define the datatype for Quantity
  // (integer vs decimal — needed for Guz measurements). Datatype will be finalized
  // after architecture approval.

  // Planning document Section 3.4: Bill items carry rate and amount information.
  // TODO: Planning document does NOT define the datatype for Rate or Bill Amount
  // (numeric precision/scale not specified). Datatypes will be finalized after
  // architecture approval.

  // TODO: Ledger update logic — "Sales Bill Save hote hi Customer ka Ledger automatically
  // update ho jayega." — is business logic and will be implemented after the Ledger table
  // and architecture are finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSalesBillItemSchema = createInsertSchema(salesBillItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesBillItem = z.infer<typeof insertSalesBillItemSchema>;
export type SalesBillItem = typeof salesBillItemsTable.$inferSelect;
