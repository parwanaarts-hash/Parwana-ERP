import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const numberSeriesTable = pgTable("number_series", {
  id: serial("id").primaryKey(),

  // Planning document Section 4.2: Each document type has its own series.
  // Defined document types: Purchase Gate Pass, Sale Gate Pass, Return Gate Pass,
  // Purchase Bill, Sales Bill, Return Bill, Payment Receive, Payment Paid.
  // TODO: Planning document does NOT define whether document_type should be constrained
  // (enum) or stored as plain text. Storage format will be finalized after architecture approval.
  documentType: text("document_type").notNull().unique(),

  // Planning document Section 4.2: Each document type has a defined prefix.
  // PGP, SGP, RGP, PB, SB, RB, PR, PP
  prefix: text("prefix").notNull(),

  // Planning document Section 4.2: "Jab bhi nayi entry save hogi, software is table se
  // next available number read karega, assign karega, aur counter update karega."
  currentNumber: integer("current_number").notNull().default(0),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNumberSeriesSchema = createInsertSchema(numberSeriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNumberSeries = z.infer<typeof insertNumberSeriesSchema>;
export type NumberSeries = typeof numberSeriesTable.$inferSelect;
