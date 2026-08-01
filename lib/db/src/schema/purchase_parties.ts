import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shikanjaTable } from "./shikanja";

export const purchasePartiesTable = pgTable("purchase_parties", {
  id: serial("id").primaryKey(),

  // Party identification
  name:     text("name").notNull(),
  nameUrdu: text("name_urdu"),

  // Contact & location
  address: text("address"),
  city:    text("city"),
  phone:   text("phone"),
  mobile:  text("mobile"),

  // Financial fields
  // AD-03: numeric(12,2) for all monetary fields
  openingCredit: numeric("opening_credit", { precision: 12, scale: 2 }),
  openingDebit:  numeric("opening_debit",  { precision: 12, scale: 2 }),

  // Party type: cash or credit
  type: text("type"),

  // Transport/delivery company for this party's goods
  shikanjaId: integer("shikanja_id").references(() => shikanjaTable.id),

  // Planning document Section 5.4: auto timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPurchasePartySchema = createInsertSchema(purchasePartiesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertPurchaseParty = z.infer<typeof insertPurchasePartySchema>;
export type PurchaseParty = typeof purchasePartiesTable.$inferSelect;
