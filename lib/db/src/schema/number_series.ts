import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const numberSeriesTable = pgTable("number_series", {
  id: serial("id").primaryKey(),

  // Planning document Section 4.2: Each document type has its own series.
  // Defined document types: Purchase Gate Pass, Sale Gate Pass, Return Gate Pass,
  // Purchase Bill, Sales Bill, Return Bill, Payment Receive, Payment Paid.
  // TODO: Planning document does NOT define storage format for document_type
  // (enum / plain text) and does NOT define whether a unique constraint should be applied.
  // Both will be finalized after architecture approval.
  documentType: text("document_type").notNull(),

  // Planning document Section 4.2: Each document type has a defined prefix.
  // PGP, SGP, RGP, PB, SB, RB, PR, PP
  prefix: text("prefix").notNull(),

  // Planning document Section 4.2: "Jab bhi nayi entry save hogi, software is table se
  // next available number read karega, assign karega, aur counter update karega."
  // TODO: Planning document does NOT define the starting value or default for this counter.
  // Default value will be finalized after architecture approval.
  currentNumber: integer("current_number").notNull(),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNumberSeriesSchema = createInsertSchema(numberSeriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNumberSeries = z.infer<typeof insertNumberSeriesSchema>;
export type NumberSeries = typeof numberSeriesTable.$inferSelect;
