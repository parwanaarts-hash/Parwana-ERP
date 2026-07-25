import { pgTable, serial, integer, text, timestamp, numeric, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Scale values stored in English; displayed in Urdu on the frontend.
// نگ = Ng | سیٹ = Set | سوٹ = Suit | تھان = Than
export const PRODUCT_SCALES = ["Ng", "Set", "Suit", "Than"] as const;
export type ProductScale = (typeof PRODUCT_SCALES)[number];

export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),

    // Unique item code — no duplicates allowed.
    itemCode: text("item_code").notNull().unique(),

    // English product name used in system.
    productName: text("product_name").notNull(),

    // Urdu print name — used on printed documents only.
    urduName: text("urdu_name"),

    // Category: Shalwar / Kameez / Dupatta / Embroidery (free-text enum on client side)
    category: text("category"),

    // Scale (unit of measurement): Ng | Set | Suit | Than
    scale: text("scale").notNull().default("Ng"),

    // Received quantity — default 0.
    qty: integer("qty").notNull().default(0),

    // Stock movement multiplier — default 1.
    stockFactor: integer("stock_factor").notNull().default(1),

    // Thaan / Gaz / Meter length multiplier.
    length: numeric("length"),

    // Per-unit rate used in billing.
    rate: numeric("rate"),

    // Free-text remarks / notes.
    remarks: text("remarks"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "products_scale_check",
      sql`${table.scale} IN ('Ng', 'Set', 'Suit', 'Than')`,
    ),
  ],
);

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
