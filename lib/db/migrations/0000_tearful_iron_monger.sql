CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "company_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"logo_path" text,
	"address" text,
	"phone_number" text,
	"mobile_number" text,
	"email_address" text,
	"ntn" text,
	"strn" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_type" text NOT NULL,
	"prefix" text NOT NULL,
	"current_number" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "number_series_document_type_unique" UNIQUE("document_type")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shikanja" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_code" text NOT NULL,
	"product_name" text NOT NULL,
	"type" text NOT NULL,
	"sub_category_id" integer,
	"shikanja_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_item_code_unique" UNIQUE("item_code"),
	CONSTRAINT "products_type_check" CHECK ("products"."type" IN ('Set', 'Than', 'Suit'))
);
--> statement-breakpoint
CREATE TABLE "purchase_parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"credit_limit" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_gate_passes" (
	"id" serial PRIMARY KEY NOT NULL,
	"gp_number" text NOT NULL,
	"date" date NOT NULL,
	"purchase_party_id" integer NOT NULL,
	"lot_number" text NOT NULL,
	"remarks" text,
	"purchase_bill_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_gate_passes_gp_number_unique" UNIQUE("gp_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_gate_pass_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_gate_pass_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" numeric(10, 3),
	"gazana" numeric(10, 3),
	"rate" numeric(12, 2),
	"received_qty" numeric(10, 3),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_gate_passes" (
	"id" serial PRIMARY KEY NOT NULL,
	"gp_number" text NOT NULL,
	"date" date NOT NULL,
	"sale_party_id" integer NOT NULL,
	"remarks" text,
	"sales_bill_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sale_gate_passes_gp_number_unique" UNIQUE("gp_number")
);
--> statement-breakpoint
CREATE TABLE "sale_gate_pass_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_gate_pass_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" numeric(10, 3),
	"gazana" numeric(10, 3),
	"rate" numeric(12, 2),
	"final_rate" numeric(12, 2),
	"total" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_gate_passes" (
	"id" serial PRIMARY KEY NOT NULL,
	"gp_number" text NOT NULL,
	"date" date NOT NULL,
	"sale_party_id" integer NOT NULL,
	"remarks" text,
	"return_bill_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "return_gate_passes_gp_number_unique" UNIQUE("gp_number")
);
--> statement-breakpoint
CREATE TABLE "return_gate_pass_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_gate_pass_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" numeric(10, 3),
	"return_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "return_gate_pass_items_return_type_check" CHECK ("return_gate_pass_items"."return_type" IN ('Fresh', 'B Mall'))
);
--> statement-breakpoint
CREATE TABLE "purchase_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_number" text NOT NULL,
	"bill_date" date NOT NULL,
	"purchase_party_id" integer NOT NULL,
	"supplier_bill_number" text,
	"lot_number" text,
	"bill_amount" numeric(12, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_bills_bill_number_unique" UNIQUE("bill_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_bill_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" numeric(10, 3),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_number" text NOT NULL,
	"bill_date" date NOT NULL,
	"sale_party_id" integer NOT NULL,
	"bill_type" text,
	"cash_payment" numeric(12, 2),
	"bank_payment" numeric(12, 2),
	"bill_amount" numeric(12, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_bills_bill_number_unique" UNIQUE("bill_number"),
	CONSTRAINT "sales_bills_bill_type_check" CHECK ("sales_bills"."bill_type" IN ('Cash', 'Credit'))
);
--> statement-breakpoint
CREATE TABLE "sales_bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sales_bill_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" numeric(10, 3),
	"gazana" numeric(10, 3),
	"rate" numeric(12, 2),
	"final_rate" numeric(12, 2),
	"total" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_number" text NOT NULL,
	"bill_date" date NOT NULL,
	"sale_party_id" integer NOT NULL,
	"bill_amount" numeric(12, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "return_bills_bill_number_unique" UNIQUE("bill_number")
);
--> statement-breakpoint
CREATE TABLE "return_bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_bill_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" numeric(10, 3),
	"gazana" numeric(10, 3),
	"rate" numeric(12, 2),
	"final_rate" numeric(12, 2),
	"total" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_receives" (
	"id" serial PRIMARY KEY NOT NULL,
	"pr_number" text NOT NULL,
	"date" date NOT NULL,
	"sale_party_id" integer NOT NULL,
	"payment_mode" text,
	"amount" numeric(12, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_receives_pr_number_unique" UNIQUE("pr_number"),
	CONSTRAINT "payment_receives_mode_check" CHECK ("payment_receives"."payment_mode" IN ('Cash', 'Bank'))
);
--> statement-breakpoint
CREATE TABLE "payment_paids" (
	"id" serial PRIMARY KEY NOT NULL,
	"pp_number" text NOT NULL,
	"date" date NOT NULL,
	"purchase_party_id" integer NOT NULL,
	"payment_mode" text,
	"amount" numeric(12, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_paids_pp_number_unique" UNIQUE("pp_number"),
	CONSTRAINT "payment_paids_mode_check" CHECK ("payment_paids"."payment_mode" IN ('Cash', 'Bank'))
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_party_id" integer,
	"purchase_party_id" integer,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"ref_no" text,
	"debit" numeric(12, 2),
	"credit" numeric(12, 2),
	"balance" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_party_check" CHECK (("ledger_entries"."sale_party_id" IS NOT NULL AND "ledger_entries"."purchase_party_id" IS NULL) OR ("ledger_entries"."sale_party_id" IS NULL AND "ledger_entries"."purchase_party_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "stock_ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"ref_no" text,
	"in_qty" numeric(10, 3),
	"out_qty" numeric(10, 3),
	"balance" numeric(10, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sub_category_id_categories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shikanja_id_shikanja_id_fk" FOREIGN KEY ("shikanja_id") REFERENCES "public"."shikanja"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_gate_passes" ADD CONSTRAINT "purchase_gate_passes_purchase_party_id_purchase_parties_id_fk" FOREIGN KEY ("purchase_party_id") REFERENCES "public"."purchase_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_gate_passes" ADD CONSTRAINT "purchase_gate_passes_purchase_bill_id_purchase_bills_id_fk" FOREIGN KEY ("purchase_bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_gate_pass_items" ADD CONSTRAINT "purchase_gate_pass_items_purchase_gate_pass_id_purchase_gate_passes_id_fk" FOREIGN KEY ("purchase_gate_pass_id") REFERENCES "public"."purchase_gate_passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_gate_pass_items" ADD CONSTRAINT "purchase_gate_pass_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_gate_passes" ADD CONSTRAINT "sale_gate_passes_sale_party_id_sale_parties_id_fk" FOREIGN KEY ("sale_party_id") REFERENCES "public"."sale_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_gate_passes" ADD CONSTRAINT "sale_gate_passes_sales_bill_id_sales_bills_id_fk" FOREIGN KEY ("sales_bill_id") REFERENCES "public"."sales_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_gate_pass_items" ADD CONSTRAINT "sale_gate_pass_items_sale_gate_pass_id_sale_gate_passes_id_fk" FOREIGN KEY ("sale_gate_pass_id") REFERENCES "public"."sale_gate_passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_gate_pass_items" ADD CONSTRAINT "sale_gate_pass_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_gate_passes" ADD CONSTRAINT "return_gate_passes_sale_party_id_sale_parties_id_fk" FOREIGN KEY ("sale_party_id") REFERENCES "public"."sale_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_gate_passes" ADD CONSTRAINT "return_gate_passes_return_bill_id_return_bills_id_fk" FOREIGN KEY ("return_bill_id") REFERENCES "public"."return_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_gate_pass_items" ADD CONSTRAINT "return_gate_pass_items_return_gate_pass_id_return_gate_passes_id_fk" FOREIGN KEY ("return_gate_pass_id") REFERENCES "public"."return_gate_passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_gate_pass_items" ADD CONSTRAINT "return_gate_pass_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_purchase_party_id_purchase_parties_id_fk" FOREIGN KEY ("purchase_party_id") REFERENCES "public"."purchase_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_purchase_bill_id_purchase_bills_id_fk" FOREIGN KEY ("purchase_bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_bills" ADD CONSTRAINT "sales_bills_sale_party_id_sale_parties_id_fk" FOREIGN KEY ("sale_party_id") REFERENCES "public"."sale_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_bill_items" ADD CONSTRAINT "sales_bill_items_sales_bill_id_sales_bills_id_fk" FOREIGN KEY ("sales_bill_id") REFERENCES "public"."sales_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_bill_items" ADD CONSTRAINT "sales_bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_bills" ADD CONSTRAINT "return_bills_sale_party_id_sale_parties_id_fk" FOREIGN KEY ("sale_party_id") REFERENCES "public"."sale_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_bill_items" ADD CONSTRAINT "return_bill_items_return_bill_id_return_bills_id_fk" FOREIGN KEY ("return_bill_id") REFERENCES "public"."return_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_bill_items" ADD CONSTRAINT "return_bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receives" ADD CONSTRAINT "payment_receives_sale_party_id_sale_parties_id_fk" FOREIGN KEY ("sale_party_id") REFERENCES "public"."sale_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_paids" ADD CONSTRAINT "payment_paids_purchase_party_id_purchase_parties_id_fk" FOREIGN KEY ("purchase_party_id") REFERENCES "public"."purchase_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_sale_party_id_sale_parties_id_fk" FOREIGN KEY ("sale_party_id") REFERENCES "public"."sale_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_purchase_party_id_purchase_parties_id_fk" FOREIGN KEY ("purchase_party_id") REFERENCES "public"."purchase_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_products_sub_category" ON "products" USING btree ("sub_category_id");--> statement-breakpoint
CREATE INDEX "idx_products_shikanja" ON "products" USING btree ("shikanja_id");--> statement-breakpoint
CREATE INDEX "idx_pgp_party" ON "purchase_gate_passes" USING btree ("purchase_party_id");--> statement-breakpoint
CREATE INDEX "idx_pgp_bill" ON "purchase_gate_passes" USING btree ("purchase_bill_id");--> statement-breakpoint
CREATE INDEX "idx_pgp_date" ON "purchase_gate_passes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_pgp_items_gate_pass" ON "purchase_gate_pass_items" USING btree ("purchase_gate_pass_id");--> statement-breakpoint
CREATE INDEX "idx_pgp_items_product" ON "purchase_gate_pass_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_sgp_party" ON "sale_gate_passes" USING btree ("sale_party_id");--> statement-breakpoint
CREATE INDEX "idx_sgp_bill" ON "sale_gate_passes" USING btree ("sales_bill_id");--> statement-breakpoint
CREATE INDEX "idx_sgp_date" ON "sale_gate_passes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_sgp_items_gate_pass" ON "sale_gate_pass_items" USING btree ("sale_gate_pass_id");--> statement-breakpoint
CREATE INDEX "idx_sgp_items_product" ON "sale_gate_pass_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_rgp_party" ON "return_gate_passes" USING btree ("sale_party_id");--> statement-breakpoint
CREATE INDEX "idx_rgp_bill" ON "return_gate_passes" USING btree ("return_bill_id");--> statement-breakpoint
CREATE INDEX "idx_rgp_date" ON "return_gate_passes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_rgp_items_gate_pass" ON "return_gate_pass_items" USING btree ("return_gate_pass_id");--> statement-breakpoint
CREATE INDEX "idx_rgp_items_product" ON "return_gate_pass_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pb_party" ON "purchase_bills" USING btree ("purchase_party_id");--> statement-breakpoint
CREATE INDEX "idx_pb_date" ON "purchase_bills" USING btree ("bill_date");--> statement-breakpoint
CREATE INDEX "idx_pb_items_bill" ON "purchase_bill_items" USING btree ("purchase_bill_id");--> statement-breakpoint
CREATE INDEX "idx_pb_items_product" ON "purchase_bill_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_sb_party" ON "sales_bills" USING btree ("sale_party_id");--> statement-breakpoint
CREATE INDEX "idx_sb_date" ON "sales_bills" USING btree ("bill_date");--> statement-breakpoint
CREATE INDEX "idx_sb_items_bill" ON "sales_bill_items" USING btree ("sales_bill_id");--> statement-breakpoint
CREATE INDEX "idx_sb_items_product" ON "sales_bill_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_rb_party" ON "return_bills" USING btree ("sale_party_id");--> statement-breakpoint
CREATE INDEX "idx_rb_date" ON "return_bills" USING btree ("bill_date");--> statement-breakpoint
CREATE INDEX "idx_rb_items_bill" ON "return_bill_items" USING btree ("return_bill_id");--> statement-breakpoint
CREATE INDEX "idx_rb_items_product" ON "return_bill_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pr_party" ON "payment_receives" USING btree ("sale_party_id");--> statement-breakpoint
CREATE INDEX "idx_pr_date" ON "payment_receives" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_pp_party" ON "payment_paids" USING btree ("purchase_party_id");--> statement-breakpoint
CREATE INDEX "idx_pp_date" ON "payment_paids" USING btree ("date");