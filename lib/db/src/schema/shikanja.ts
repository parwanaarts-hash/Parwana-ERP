import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shikanjaTable = pgTable("shikanja", {
  id: serial("id").primaryKey(),

  // Planning document Section 2.1: "Products ko company ke internal Shikanja ke mutabiq
  // organize karna. Product create karte waqt Shikanja dropdown se select kiya jayega."
  name: text("name").notNull(),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShikanjaSchema = createInsertSchema(shikanjaTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShikanja = z.infer<typeof insertShikanjaSchema>;
export type Shikanja = typeof shikanjaTable.$inferSelect;
