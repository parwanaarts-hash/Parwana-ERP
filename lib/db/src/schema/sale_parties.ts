import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salePartiesTable = pgTable("sale_parties", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.1: "Jin customers ko hum maal sale karte hain unki
  // entries yahan save hongi."
  // Name is required for party identification and dropdown selection across all registers
  // (Sale Gate Pass, Return Gate Pass, Sales Bill, Return Bill, Payment Receive).
  name: text("name").notNull(),

  // Planning document Section 2.1: "Credit Limit bhi is master mein store hogi."
  // Architecture decision AD-03: numeric(12,2) for all monetary fields.
  // Nullable: not every sale party has a defined credit limit.
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),

  // TODO: Planning document does NOT explicitly define any additional fields for Sale Parties
  // (e.g. phone, address, city, opening balance, etc.).
  // All additional fields will be added after explicit approval.

  // TODO: Planning document Section 2.1 states: "Jab bhi nayi Sale Party create hogi,
  // software automatically ERP Module mein us Party ka Ledger create kar dega."
  // This is business logic — ledger auto-creation will be implemented in the backend phase.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSalePartySchema = createInsertSchema(salePartiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSaleParty = z.infer<typeof insertSalePartySchema>;
export type SaleParty = typeof salePartiesTable.$inferSelect;
