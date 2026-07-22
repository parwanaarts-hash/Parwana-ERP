import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salePartiesTable = pgTable("sale_parties", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.1: "Jin customers ko hum maal sale karte hain unki
  // entries yahan save hongi."
  // Name is required for party identification and dropdown selection across all registers
  // (Sale Gate Pass, Return Gate Pass, Sales Bill, Return Bill, Payment Receive).
  name: text("name").notNull(),

  // Planning document Section 2.1 (Sale Parties): "Credit Limit bhi is master mein store hogi."
  // TODO: Credit Limit field will be implemented after the complete database architecture
  // is finalized and approved. Planning document defines this field must be stored but does
  // NOT define its datatype.

  // TODO: Planning document does NOT explicitly define any additional fields for Sale Parties
  // (e.g. phone, address, city, opening balance, etc.).
  // All additional fields will be added after the complete database architecture is
  // finalized and approved.

  // TODO: Planning document Section 2.1 states: "Jab bhi nayi Sale Party create hogi,
  // software automatically ERP Module mein us Party ka Ledger create kar dega."
  // This is business logic — ledger auto-creation will be implemented after the Ledger
  // table and its architecture are finalized and approved.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSalePartySchema = createInsertSchema(salePartiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSaleParty = z.infer<typeof insertSalePartySchema>;
export type SaleParty = typeof salePartiesTable.$inferSelect;
