import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),

  // Planning document Section 4.7: "Har User ka apna Username hoga"
  username: text("username").notNull().unique(),

  // Planning document Section 4.7: "Tamam Passwords securely store kiye jayenge"
  // Password hashed form mein store hoga — plain text nahi
  password: text("password").notNull(),

  // Planning document Section 4.7: "Software mein alag alag User Roles assign kiye ja sakenge.
  // Example: Admin, Staff."
  // Currently stored as plain text (neutral placeholder — same approach as other fields
  // pending architecture finalization).
  // TODO: Planning document does NOT define the storage format for role
  // (enum / separate roles table / plain text). Final format will be decided during
  // architecture review and this field updated accordingly.
  role: text("role").notNull(),

  // TODO: Permissions implementation is pending until the complete database architecture is finalized.

  // Planning document Section 5.4: Har transaction ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
