import { pgTable, serial, integer, text, date, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const stockLedgerEntriesTable = pgTable("stock_ledger_entries", {
  id: serial("id").primaryKey(),

  // Stock Ledger is Product-based. Every entry belongs to one product.
  // ON DELETE RESTRICT: a product cannot be deleted while it has stock ledger history.
  // Architecture decision: Stock Ledger = Product-based only.
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),

  // Architecture decision AD-01: date type (not timestamp).
  // Planning document shows Date as a calendar date — no time-of-day required.
  // Audit timestamp (created_at / updated_at) captures exact save time.
  date: date("date").notNull(),

  // Human-readable description of the stock movement.
  // Examples: "Purchase Received", "Sale Dispatched", "Fresh Return Received"
  description: text("description").notNull(),

  // Reference document number that caused this stock movement.
  // Examples: PGP0001 (purchase received), SGP0001 (sale dispatched), RGP0001 (return).
  // Nullable: opening balance entries may have no reference document.
  refNo: text("ref_no"),

  // Architecture decision AD-02: numeric(10,3) for all quantity fields.
  // Handles whole units (Set, Suit) and fractional Guz (Than) uniformly.
  // in_qty: stock received (Purchase Gate Pass received qty, Fresh Return qty).
  // Nullable: OUT-only entries will have in_qty as null.
  inQty: numeric("in_qty", { precision: 10, scale: 3 }),

  // out_qty: stock dispatched (Sale Gate Pass qty).
  // Nullable: IN-only entries will have out_qty as null.
  outQty: numeric("out_qty", { precision: 10, scale: 3 }),

  // Running balance for this product after this entry.
  // Architecture decision AD-20 (applied to stock ledger): balance stored as a column.
  // Maintained by application/business logic on every stock movement save.
  // Formula: previous_balance + in_qty - out_qty
  balance: numeric("balance", { precision: 10, scale: 3 }).notNull(),

  // TODO: Stock posting logic — entries are auto-created when Gate Passes are saved.
  // PGP: in_qty = received_qty (not gate_pass_qty per planning document).
  // SGP: out_qty = dispatched qty.
  // RGP Fresh: in_qty = returned qty. RGP B Mall: no stock entry.
  // Business logic will be implemented after architecture is finalized.

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStockLedgerEntrySchema = createInsertSchema(stockLedgerEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStockLedgerEntry = z.infer<typeof insertStockLedgerEntrySchema>;
export type StockLedgerEntry = typeof stockLedgerEntriesTable.$inferSelect;
