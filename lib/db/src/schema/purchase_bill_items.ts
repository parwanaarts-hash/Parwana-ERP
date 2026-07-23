import { pgTable, serial, numeric, timestamp } from "drizzle-orm/pg-core";
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
  // Architecture decision AD-02: numeric(10,3) — covers whole units (Set/Suit)
  // and fractional Guz (Than) uniformly.
  qty: numeric("qty", { precision: 10, scale: 3 }),

  // Planning document Section 3.3 Main Fields: "Bill Amount" is defined at the header level.
  // AD-21: item-level rate and amount fields for Purchase Bill Items are not yet approved.
  // Do NOT add rate, final_rate, or total without explicit approval.

  // TODO: Planning document does NOT explicitly define rate or amount fields at the item
  // level for Purchase Bills. Whether item-level rate or amount columns are required will
  // be determined after the complete database architecture is approved.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPurchaseBillItemSchema = createInsertSchema(purchaseBillItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseBillItem = z.infer<typeof insertPurchaseBillItemSchema>;
export type PurchaseBillItem = typeof purchaseBillItemsTable.$inferSelect;
