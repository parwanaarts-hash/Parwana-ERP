import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companyInfoTable = pgTable("company_info", {
  id: serial("id").primaryKey(),

  // Planning document Section 5.5: "Company Name"
  companyName: text("company_name").notNull(),

  // Architecture decision AD-23: logo_path stored as nullable text.
  // Stores the file system path to the uploaded logo image.
  // Nullable: logo upload is optional — not all installations will configure a logo.
  logoPath: text("logo_path"),

  // Planning document Section 5.5: "Address"
  address: text("address"),

  // Planning document Section 5.5: "Phone Number"
  phoneNumber: text("phone_number"),

  // Planning document Section 5.5: "Mobile Number"
  mobileNumber: text("mobile_number"),

  // Planning document Section 5.5: "Email Address"
  emailAddress: text("email_address"),

  // Planning document Section 5.5: "NTN (Optional)"
  ntn: text("ntn"),

  // Planning document Section 5.5: "STRN (Optional)"
  strn: text("strn"),

  // Planning document Section 5.4: Har record ke sath Date aur Time automatically save hogi
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanyInfoSchema = createInsertSchema(companyInfoTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyInfo = z.infer<typeof insertCompanyInfoSchema>;
export type CompanyInfo = typeof companyInfoTable.$inferSelect;
