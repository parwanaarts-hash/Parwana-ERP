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
  // TODO: Planning document role ka storage format (enum / separate roles table / plain text)
  // explicitly define nahi karta. Implementation format approval ke baad finalize hoga.
  role: text("role").notNull(),

  // TODO: Permissions storage mechanism will be implemented after the complete database
  // architecture is finalized and approved.
  // Planning document Section 4.7 defines the concept of permissions (Stock Module Access,
  // ERP Module Access, Masters Access, Reports Access, History Access) but does NOT define
  // how they should be stored. No implementation added until storage format is approved.

  // Planning document Section 5.4: Har transaction ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
