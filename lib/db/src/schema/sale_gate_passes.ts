import { pgTable, serial, integer, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salePartiesTable } from "./sale_parties";
import { salesBillsTable } from "./sales_bills";

export const saleGatePassesTable = pgTable("sale_gate_passes", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.3: "Har Sale Gate Pass ka apna unique serial number hoga."
  // Example: SGP0001, SGP0002, SGP0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // Architecture decision AD-18: UNIQUE constraint — no two gate passes share a number.
  // Architecture decision AD-09: auto-generation via number_series table (business logic,
  // implemented in backend phase).
  gpNumber: text("gp_number").notNull().unique(),

  // Architecture decision AD-01: date type. Calendar date only — no time-of-day required.
  date: date("date").notNull(),

  // Architecture decision AD-13: party FK — NOT NULL, ON DELETE RESTRICT.
  // Every Sale Gate Pass must belong to a Sale Party.
  // A Sale Party cannot be deleted while it has gate pass records.
  salePartyId: integer("sale_party_id")
    .notNull()
    .references(() => salePartiesTable.id, { onDelete: "restrict" }),

  // Planning document Section 2.3 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Architecture decision AD-16: Gate Pass stores nullable Bill FK.
  // One Gate Pass belongs to at most one Sales Bill.
  // One Sales Bill may contain one or many Sale Gate Passes.
  // Nullable: a newly created Gate Pass has no bill yet — bill is created later.
  // ON DELETE SET NULL: deleting a Sales Bill does not delete its Gate Passes;
  // their sales_bill_id is set to null, making them available for re-billing.
  salesBillId: integer("sales_bill_id")
    .references(() => salesBillsTable.id, { onDelete: "set null" }),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_sgp_party").on(table.salePartyId),
  index("idx_sgp_bill").on(table.salesBillId),
  // Architecture decision AD-22: date-range index.
  index("idx_sgp_date").on(table.date),
]);

export const insertSaleGatePassSchema = createInsertSchema(saleGatePassesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSaleGatePass = z.infer<typeof insertSaleGatePassSchema>;
export type SaleGatePass = typeof saleGatePassesTable.$inferSelect;
