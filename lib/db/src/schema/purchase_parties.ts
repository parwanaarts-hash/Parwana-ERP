import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchasePartiesTable = pgTable("purchase_parties", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.1: "Jin suppliers se hum Print, Embroidery ya dusra maal
  // purchase karte hain unki entries yahan save hongi."
  // Name is required for party identification and dropdown selection across all registers
  // (Purchase Gate Pass Register, Purchase Bill Register, Payment Paid Register).
  name: text("name").notNull(),

  // TODO: Planning document does NOT explicitly define any additional fields for Purchase
  // Parties (e.g. phone, address, city, NTN, opening balance, etc.).
  // All additional fields will be added after the complete database architecture is
  // finalized and approved.

  // TODO: Planning document Section 2.1 states: "Jab bhi nayi Purchase Party create hogi,
  // software automatically ERP Module mein us Party ka Ledger create kar dega."
  // This is business logic — ledger auto-creation will be implemented after the Ledger
  // table and its architecture are finalized and approved.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPurchasePartySchema = createInsertSchema(purchasePartiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseParty = z.infer<typeof insertPurchasePartySchema>;
export type PurchaseParty = typeof purchasePartiesTable.$inferSelect;
