import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const saleGatePassItemsTable = pgTable("sale_gate_pass_items", {
  id: serial("id").primaryKey(),

  // TODO: Parent relationship (sale_gate_pass_id) will be implemented after the
  // complete database relationship architecture is finalized and approved.

  // TODO: Product relationship (product_id) will be implemented after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 2.3 Main Fields: "Quantity"
  // "User sirf dispatch hone wali actual Quantity enter karega."
  // TODO: Planning document does NOT define the datatype for Quantity
  // (integer vs decimal — needed for Guz measurements). Datatype will be finalized
  // after architecture approval.

  // TODO: Stock update logic — "Jese hi Sale Gate Pass Save hoga, software warehouse ke
  // Stock se utni Quantity automatically minus kar dega." — is business logic and will be
  // implemented after architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSaleGatePassItemSchema = createInsertSchema(saleGatePassItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSaleGatePassItem = z.infer<typeof insertSaleGatePassItemSchema>;
export type SaleGatePassItem = typeof saleGatePassItemsTable.$inferSelect;
