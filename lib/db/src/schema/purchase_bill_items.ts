import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseBillItemsTable = pgTable("purchase_bill_items", {
  id: serial("id").primaryKey(),

  // TODO: Parent relationship (purchase_bill_id) will be implemented after the
  // complete database relationship architecture is finalized and approved.

  // TODO: Product relationship (product_id) will be implemented after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 3.3 Main Fields: "Product Details (Auto Load)"
  // Auto-loaded fields include: Product Name, Quantity, Lot Number.
  // TODO: Planning document does NOT define the datatype for Quantity
  // (integer vs decimal — needed for Guz measurements). Datatype will be finalized
  // after architecture approval.

  // Planning document Section 3.3: Bill items will carry rate and amount information.
  // TODO: Planning document does NOT define the datatype for Rate or Bill Amount
  // (numeric precision/scale not specified). Datatypes will be finalized after
  // architecture approval.

  // TODO: Ledger update logic — "Purchase Bill Save hote hi Purchase Party ke Ledger
  // mein Purchase Amount automatically update ho jayegi." — is business logic and will
  // be implemented after the Ledger table and architecture are finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPurchaseBillItemSchema = createInsertSchema(purchaseBillItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseBillItem = z.infer<typeof insertPurchaseBillItemSchema>;
export type PurchaseBillItem = typeof purchaseBillItemsTable.$inferSelect;
