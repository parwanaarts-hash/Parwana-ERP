import { pgTable, serial, integer, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { purchasePartiesTable } from "./purchase_parties";
import { purchaseBillsTable } from "./purchase_bills";

export const purchaseGatePassesTable = pgTable("purchase_gate_passes", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.2: "Har Purchase Gate Pass ka apna unique serial number hoga."
  // Example: PGP0001, PGP0002, PGP0003
  // Stored as text to hold the full formatted serial (prefix + number).
  // Architecture decision AD-18: UNIQUE constraint — no two gate passes share a number.
  // Architecture decision AD-09: auto-generation via number_series table (business logic,
  // implemented in backend phase).
  gpNumber: text("gp_number").notNull().unique(),

  // Architecture decision AD-01: date type. Calendar date only — no time-of-day required.
  date: date("date").notNull(),

  // Architecture decision AD-13: party FK — NOT NULL, ON DELETE RESTRICT.
  // Every Purchase Gate Pass must belong to a Purchase Party.
  // A Purchase Party cannot be deleted while it has gate pass records.
  purchasePartyId: integer("purchase_party_id")
    .notNull()
    .references(() => purchasePartiesTable.id, { onDelete: "restrict" }),

  // Planning document Section 2.2: "Har Purchase Gate Pass mein Lot Number enter karna
  // lazmi hoga. Ye Lot Number supplier ke Gate Pass par bhi hoga."
  lotNumber: text("lot_number").notNull(),

  // Planning document Section 2.2 Main Fields: "Remarks"
  remarks: text("remarks"),

  // Architecture decision AD-16: Gate Pass stores nullable Bill FK.
  // One Gate Pass belongs to at most one Purchase Bill.
  // One Purchase Bill may contain one or many Purchase Gate Passes.
  // Nullable: a newly created Gate Pass has no bill yet — bill is created later.
  // ON DELETE SET NULL: deleting a Purchase Bill does not delete its Gate Passes;
  // their purchase_bill_id is set to null, making them available for re-billing.
  purchaseBillId: integer("purchase_bill_id")
    .references(() => purchaseBillsTable.id, { onDelete: "set null" }),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => [
  // Architecture decision AD-22: FK indexes for query performance.
  index("idx_pgp_party").on(table.purchasePartyId),
  index("idx_pgp_bill").on(table.purchaseBillId),
  // Architecture decision AD-22: date-range index — gate passes are frequently
  // queried by date period.
  index("idx_pgp_date").on(table.date),
]);

export const insertPurchaseGatePassSchema = createInsertSchema(purchaseGatePassesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseGatePass = z.infer<typeof insertPurchaseGatePassSchema>;
export type PurchaseGatePass = typeof purchaseGatePassesTable.$inferSelect;
