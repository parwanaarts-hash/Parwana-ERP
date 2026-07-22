import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const returnBillItemsTable = pgTable("return_bill_items", {
  id: serial("id").primaryKey(),

  // TODO: Parent relationship (return_bill_id) will be implemented after the
  // complete database relationship architecture is finalized and approved.

  // TODO: Product relationship (product_id) will be implemented after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 3.5: Bill items carry quantity and amount information
  // auto-loaded from the Return Gate Pass.
  // TODO: Planning document does NOT define the datatype for Quantity
  // (integer vs decimal — needed for Guz measurements). Datatype will be finalized
  // after architecture approval.

  // TODO: Planning document does NOT define the datatype for Rate or Bill Amount
  // (numeric precision/scale not specified). Datatypes will be finalized after
  // architecture approval.

  // TODO: Ledger update logic — "Return Bill Save hote hi Customer ka Ledger automatically
  // update ho jayega." — is business logic and will be implemented after the Ledger table
  // and architecture are finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReturnBillItemSchema = createInsertSchema(returnBillItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReturnBillItem = z.infer<typeof insertReturnBillItemSchema>;
export type ReturnBillItem = typeof returnBillItemsTable.$inferSelect;
