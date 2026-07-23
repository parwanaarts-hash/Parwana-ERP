import { pgTable, serial, integer, text, numeric, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { returnGatePassesTable } from "./return_gate_passes";
import { productsTable } from "./products";

export const returnGatePassItemsTable = pgTable("return_gate_pass_items", {
  id: serial("id").primaryKey(),

  // Architecture decision AD-14: parent FK — NOT NULL, ON DELETE CASCADE.
  // Each item row belongs to exactly one Return Gate Pass.
  // Deleting a Return Gate Pass removes all its item rows.
  returnGatePassId: integer("return_gate_pass_id")
    .notNull()
    .references(() => returnGatePassesTable.id, { onDelete: "cascade" }),

  // Architecture decision AD-15: product FK — NOT NULL, ON DELETE RESTRICT.
  // Each item row references exactly one product from the Products master.
  // A product cannot be deleted while it has transaction item rows referencing it.
  // Product name is never stored here — always loaded through this relationship.
  // UI supports searching by Product Name or Product Code/ID; both resolve to product_id only.
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),

  // Planning document Section 2.4 Main Fields: "Quantity"
  // "User sirf actual Return Quantity enter karega."
  // Architecture decision AD-02: numeric(10,3) — covers whole units (Set/Suit)
  // and fractional Guz (Than) uniformly.
  qty: numeric("qty", { precision: 10, scale: 3 }),

  // Planning document Section 2.4 Main Fields: "Fresh", "B Mall"
  // "Har Product ke samne 2 Check Boxes honge — Fresh / B Mall.
  // Ek time par sirf ek Checkbox select ho sakega."
  // Architecture decision AD-08: stored as text with CHECK constraint.
  // Allowed values: 'Fresh', 'B Mall' — exactly as defined in the planning document.
  // Nullable: type may not be selected until the gate pass is fully filled.
  // Stock impact: Fresh → stock increases. B Mall → no stock change (business logic).
  returnType: text("return_type"),

  // TODO: Stock update logic — "Sirf Fresh Return Stock mein add hoga. B Mall kabhi bhi
  // Stock increase nahi karega." — is business logic and will be implemented in the
  // backend phase.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-08: return_type must be one of the two defined return types.
  check("return_gate_pass_items_return_type_check", sql`${table.returnType} IN ('Fresh', 'B Mall')`),

  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_rgp_items_gate_pass").on(table.returnGatePassId),
  index("idx_rgp_items_product").on(table.productId),
]);

export const insertReturnGatePassItemSchema = createInsertSchema(returnGatePassItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReturnGatePassItem = z.infer<typeof insertReturnGatePassItemSchema>;
export type ReturnGatePassItem = typeof returnGatePassItemsTable.$inferSelect;
