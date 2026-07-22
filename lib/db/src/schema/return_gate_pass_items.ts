import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const returnGatePassItemsTable = pgTable("return_gate_pass_items", {
  id: serial("id").primaryKey(),

  // TODO: Parent relationship (return_gate_pass_id) will be implemented after the
  // complete database relationship architecture is finalized and approved.

  // TODO: Product relationship (product_id) will be implemented after the complete
  // database relationship architecture is finalized and approved.

  // Planning document Section 2.4 Main Fields: "Quantity"
  // "User sirf actual Return Quantity enter karega."
  // TODO: Planning document does NOT define the datatype for Quantity
  // (integer vs decimal — needed for Guz measurements). Datatype will be finalized
  // after architecture approval.

  // Planning document Section 2.4 Main Fields: "Fresh", "B Mall"
  // "Har Product ke samne 2 Check Boxes honge — Fresh / B Mall.
  // Ek time par sirf ek Checkbox select ho sakega."
  // TODO: Planning document does NOT define the storage datatype for Fresh/B Mall
  // (boolean flags, single enum field, or another approach). Implementation will be
  // finalized after architecture approval.

  // TODO: Stock update logic — "Sirf Fresh Return Stock mein add hoga. B Mall kabhi bhi
  // Stock increase nahi karega." — is business logic and will be implemented after
  // architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReturnGatePassItemSchema = createInsertSchema(returnGatePassItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReturnGatePassItem = z.infer<typeof insertReturnGatePassItemSchema>;
export type ReturnGatePassItem = typeof returnGatePassItemsTable.$inferSelect;
