import { pgTable, serial, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesBillItemsTable = pgTable("sales_bill_items", {
  id: serial("id").primaryKey(),

  // TODO: Parent relationship (sales_bill_id) will be implemented after the
  // complete database relationship architecture is finalized and approved.

  // TODO: Product relationship (product_id) will be implemented after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 3.4 Main Fields: "Quantity"
  // Auto-loaded from Sale Gate Pass.
  // Architecture decision AD-02: numeric(10,3) — covers whole units (Set/Suit)
  // and fractional Guz (Than) uniformly.
  qty: numeric("qty", { precision: 10, scale: 3 }),

  // Gazana: per-piece Guz measurement for Than-type products.
  // Architecture decision AD-02: numeric(10,3) — measurement value, not monetary.
  gazana: numeric("gazana", { precision: 10, scale: 3 }),

  // Base rate for the item.
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  rate: numeric("rate", { precision: 12, scale: 2 }),

  // Final negotiated/calculated rate applied to this line item.
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  finalRate: numeric("final_rate", { precision: 12, scale: 2 }),

  // Line item total amount.
  // Architecture decision AD-03: numeric(12,2) — monetary field.
  total: numeric("total", { precision: 12, scale: 2 }),

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
