import { pgTable, unique, serial, text, timestamp, integer, foreignKey, check, numeric, index, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	role: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
]);

export const companyInfo = pgTable("company_info", {
	id: serial().primaryKey().notNull(),
	companyName: text("company_name").notNull(),
	logoPath: text("logo_path"),
	address: text(),
	phoneNumber: text("phone_number"),
	mobileNumber: text("mobile_number"),
	emailAddress: text("email_address"),
	ntn: text(),
	strn: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const numberSeries = pgTable("number_series", {
	id: serial().primaryKey().notNull(),
	documentType: text("document_type").notNull(),
	prefix: text().notNull(),
	currentNumber: integer("current_number").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("number_series_document_type_unique").on(table.documentType),
]);

export const shikanja = pgTable("shikanja", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	itemCode: text("item_code").notNull(),
	productName: text("product_name").notNull(),
	urduName: text("urdu_name"),
	category: text(),
	scale: text().default('Ng').notNull(),
	qty: integer().default(0).notNull(),
	stockFactor: integer("stock_factor").default(1).notNull(),
	length: numeric(),
	rate: numeric(),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	subCategoryId: integer("sub_category_id"),
	shikanjaId: integer("shikanja_id"),
}, (table) => [
	foreignKey({
			columns: [table.shikanjaId],
			foreignColumns: [shikanja.id],
			name: "products_shikanja_id_shikanja_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.subCategoryId],
			foreignColumns: [categories.id],
			name: "products_sub_category_id_categories_id_fk"
		}).onDelete("set null"),
	unique("products_item_code_unique").on(table.itemCode),
	check("products_scale_check", sql`scale = ANY (ARRAY['Ng'::text, 'Set'::text, 'Suit'::text, 'Than'::text])`),
]);

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	parentId: integer("parent_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "categories_parent_id_categories_id_fk"
		}).onDelete("restrict"),
]);

export const purchaseGatePassItems = pgTable("purchase_gate_pass_items", {
	id: serial().primaryKey().notNull(),
	purchaseGatePassId: integer("purchase_gate_pass_id").notNull(),
	productId: integer("product_id").notNull(),
	qty: numeric({ precision: 10, scale:  3 }),
	gazana: numeric({ precision: 10, scale:  3 }),
	rate: numeric({ precision: 12, scale:  2 }),
	receivedQty: numeric("received_qty", { precision: 10, scale:  3 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pgp_items_gate_pass").using("btree", table.purchaseGatePassId.asc().nullsLast().op("int4_ops")),
	index("idx_pgp_items_product").using("btree", table.productId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "purchase_gate_pass_items_product_id_products_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.purchaseGatePassId],
			foreignColumns: [purchaseGatePasses.id],
			name: "purchase_gate_pass_items_purchase_gate_pass_id_purchase_gate_pa"
		}).onDelete("cascade"),
]);

export const saleParties = pgTable("sale_parties", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	nameUrdu: text("name_urdu"),
	address: text(),
	city: text(),
	phone: text(),
	mobile: text(),
	creditLimit: numeric("credit_limit", { precision: 12, scale:  2 }),
	openingCredit: numeric("opening_credit", { precision: 12, scale:  2 }),
	openingDebit: numeric("opening_debit", { precision: 12, scale:  2 }),
	type: text(),
	shikanjaId: integer("shikanja_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.shikanjaId],
			foreignColumns: [shikanja.id],
			name: "sale_parties_shikanja_id_shikanja_id_fk"
		}),
]);

export const saleGatePasses = pgTable("sale_gate_passes", {
	id: serial().primaryKey().notNull(),
	gpNumber: text("gp_number").notNull(),
	date: date().notNull(),
	salePartyId: integer("sale_party_id").notNull(),
	remarks: text(),
	salesBillId: integer("sales_bill_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sgp_bill").using("btree", table.salesBillId.asc().nullsLast().op("int4_ops")),
	index("idx_sgp_date").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("idx_sgp_party").using("btree", table.salePartyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.salePartyId],
			foreignColumns: [saleParties.id],
			name: "sale_gate_passes_sale_party_id_sale_parties_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.salesBillId],
			foreignColumns: [salesBills.id],
			name: "sale_gate_passes_sales_bill_id_sales_bills_id_fk"
		}).onDelete("set null"),
	unique("sale_gate_passes_gp_number_unique").on(table.gpNumber),
]);

export const saleGatePassItems = pgTable("sale_gate_pass_items", {
	id: serial().primaryKey().notNull(),
	saleGatePassId: integer("sale_gate_pass_id").notNull(),
	productId: integer("product_id").notNull(),
	qty: numeric({ precision: 10, scale:  3 }),
	gazana: numeric({ precision: 10, scale:  3 }),
	rate: numeric({ precision: 12, scale:  2 }),
	finalRate: numeric("final_rate", { precision: 12, scale:  2 }),
	total: numeric({ precision: 12, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sgp_items_gate_pass").using("btree", table.saleGatePassId.asc().nullsLast().op("int4_ops")),
	index("idx_sgp_items_product").using("btree", table.productId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "sale_gate_pass_items_product_id_products_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.saleGatePassId],
			foreignColumns: [saleGatePasses.id],
			name: "sale_gate_pass_items_sale_gate_pass_id_sale_gate_passes_id_fk"
		}).onDelete("cascade"),
]);

export const purchaseBillItems = pgTable("purchase_bill_items", {
	id: serial().primaryKey().notNull(),
	purchaseBillId: integer("purchase_bill_id").notNull(),
	productId: integer("product_id").notNull(),
	qty: numeric({ precision: 10, scale:  3 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pb_items_bill").using("btree", table.purchaseBillId.asc().nullsLast().op("int4_ops")),
	index("idx_pb_items_product").using("btree", table.productId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "purchase_bill_items_product_id_products_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.purchaseBillId],
			foreignColumns: [purchaseBills.id],
			name: "purchase_bill_items_purchase_bill_id_purchase_bills_id_fk"
		}).onDelete("cascade"),
]);

export const salesBills = pgTable("sales_bills", {
	id: serial().primaryKey().notNull(),
	billNumber: text("bill_number").notNull(),
	billDate: date("bill_date").notNull(),
	salePartyId: integer("sale_party_id").notNull(),
	billType: text("bill_type"),
	cashPayment: numeric("cash_payment", { precision: 12, scale:  2 }),
	bankPayment: numeric("bank_payment", { precision: 12, scale:  2 }),
	billAmount: numeric("bill_amount", { precision: 12, scale:  2 }),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sb_date").using("btree", table.billDate.asc().nullsLast().op("date_ops")),
	index("idx_sb_party").using("btree", table.salePartyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.salePartyId],
			foreignColumns: [saleParties.id],
			name: "sales_bills_sale_party_id_sale_parties_id_fk"
		}).onDelete("restrict"),
	unique("sales_bills_bill_number_unique").on(table.billNumber),
	check("sales_bills_bill_type_check", sql`bill_type = ANY (ARRAY['Cash'::text, 'Credit'::text])`),
]);

export const returnGatePasses = pgTable("return_gate_passes", {
	id: serial().primaryKey().notNull(),
	gpNumber: text("gp_number").notNull(),
	date: date().notNull(),
	salePartyId: integer("sale_party_id").notNull(),
	remarks: text(),
	returnBillId: integer("return_bill_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_rgp_bill").using("btree", table.returnBillId.asc().nullsLast().op("int4_ops")),
	index("idx_rgp_date").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("idx_rgp_party").using("btree", table.salePartyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.returnBillId],
			foreignColumns: [returnBills.id],
			name: "return_gate_passes_return_bill_id_return_bills_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.salePartyId],
			foreignColumns: [saleParties.id],
			name: "return_gate_passes_sale_party_id_sale_parties_id_fk"
		}).onDelete("restrict"),
	unique("return_gate_passes_gp_number_unique").on(table.gpNumber),
]);

export const returnGatePassItems = pgTable("return_gate_pass_items", {
	id: serial().primaryKey().notNull(),
	returnGatePassId: integer("return_gate_pass_id").notNull(),
	productId: integer("product_id").notNull(),
	qty: numeric({ precision: 10, scale:  3 }),
	returnType: text("return_type"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_rgp_items_gate_pass").using("btree", table.returnGatePassId.asc().nullsLast().op("int4_ops")),
	index("idx_rgp_items_product").using("btree", table.productId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "return_gate_pass_items_product_id_products_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.returnGatePassId],
			foreignColumns: [returnGatePasses.id],
			name: "return_gate_pass_items_return_gate_pass_id_return_gate_passes_i"
		}).onDelete("cascade"),
	check("return_gate_pass_items_return_type_check", sql`return_type = ANY (ARRAY['Fresh'::text, 'B Mall'::text])`),
]);

export const purchaseBills = pgTable("purchase_bills", {
	id: serial().primaryKey().notNull(),
	billNumber: text("bill_number").notNull(),
	billDate: date("bill_date").notNull(),
	purchasePartyId: integer("purchase_party_id").notNull(),
	supplierBillNumber: text("supplier_bill_number"),
	lotNumber: text("lot_number"),
	billAmount: numeric("bill_amount", { precision: 12, scale:  2 }),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pb_date").using("btree", table.billDate.asc().nullsLast().op("date_ops")),
	index("idx_pb_party").using("btree", table.purchasePartyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.purchasePartyId],
			foreignColumns: [purchaseParties.id],
			name: "purchase_bills_purchase_party_id_purchase_parties_id_fk"
		}).onDelete("restrict"),
	unique("purchase_bills_bill_number_unique").on(table.billNumber),
]);

export const returnBills = pgTable("return_bills", {
	id: serial().primaryKey().notNull(),
	billNumber: text("bill_number").notNull(),
	billDate: date("bill_date").notNull(),
	salePartyId: integer("sale_party_id").notNull(),
	billAmount: numeric("bill_amount", { precision: 12, scale:  2 }),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_rb_date").using("btree", table.billDate.asc().nullsLast().op("date_ops")),
	index("idx_rb_party").using("btree", table.salePartyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.salePartyId],
			foreignColumns: [saleParties.id],
			name: "return_bills_sale_party_id_sale_parties_id_fk"
		}).onDelete("restrict"),
	unique("return_bills_bill_number_unique").on(table.billNumber),
]);

export const salesBillItems = pgTable("sales_bill_items", {
	id: serial().primaryKey().notNull(),
	salesBillId: integer("sales_bill_id").notNull(),
	productId: integer("product_id").notNull(),
	qty: numeric({ precision: 10, scale:  3 }),
	gazana: numeric({ precision: 10, scale:  3 }),
	rate: numeric({ precision: 12, scale:  2 }),
	finalRate: numeric("final_rate", { precision: 12, scale:  2 }),
	total: numeric({ precision: 12, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sb_items_bill").using("btree", table.salesBillId.asc().nullsLast().op("int4_ops")),
	index("idx_sb_items_product").using("btree", table.productId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "sales_bill_items_product_id_products_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.salesBillId],
			foreignColumns: [salesBills.id],
			name: "sales_bill_items_sales_bill_id_sales_bills_id_fk"
		}).onDelete("cascade"),
]);

export const stockLedgerEntries = pgTable("stock_ledger_entries", {
	id: serial().primaryKey().notNull(),
	productId: integer("product_id").notNull(),
	date: date().notNull(),
	description: text().notNull(),
	refNo: text("ref_no"),
	inQty: numeric("in_qty", { precision: 10, scale:  3 }),
	outQty: numeric("out_qty", { precision: 10, scale:  3 }),
	balance: numeric({ precision: 10, scale:  3 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_ledger_entries_product_id_products_id_fk"
		}).onDelete("restrict"),
]);

export const paymentPaids = pgTable("payment_paids", {
	id: serial().primaryKey().notNull(),
	ppNumber: text("pp_number").notNull(),
	date: date().notNull(),
	purchasePartyId: integer("purchase_party_id").notNull(),
	paymentMode: text("payment_mode"),
	amount: numeric({ precision: 12, scale:  2 }),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pp_date").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("idx_pp_party").using("btree", table.purchasePartyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.purchasePartyId],
			foreignColumns: [purchaseParties.id],
			name: "payment_paids_purchase_party_id_purchase_parties_id_fk"
		}).onDelete("restrict"),
	unique("payment_paids_pp_number_unique").on(table.ppNumber),
	check("payment_paids_mode_check", sql`payment_mode = ANY (ARRAY['Cash'::text, 'Bank'::text])`),
]);

export const ledgerEntries = pgTable("ledger_entries", {
	id: serial().primaryKey().notNull(),
	salePartyId: integer("sale_party_id"),
	purchasePartyId: integer("purchase_party_id"),
	date: date().notNull(),
	description: text().notNull(),
	refNo: text("ref_no"),
	debit: numeric({ precision: 12, scale:  2 }),
	credit: numeric({ precision: 12, scale:  2 }),
	balance: numeric({ precision: 12, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.purchasePartyId],
			foreignColumns: [purchaseParties.id],
			name: "ledger_entries_purchase_party_id_purchase_parties_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.salePartyId],
			foreignColumns: [saleParties.id],
			name: "ledger_entries_sale_party_id_sale_parties_id_fk"
		}).onDelete("restrict"),
	check("ledger_party_check", sql`((sale_party_id IS NOT NULL) AND (purchase_party_id IS NULL)) OR ((sale_party_id IS NULL) AND (purchase_party_id IS NOT NULL))`),
]);

export const purchaseParties = pgTable("purchase_parties", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	nameUrdu: text("name_urdu"),
	address: text(),
	city: text(),
	phone: text(),
	mobile: text(),
	openingCredit: numeric("opening_credit", { precision: 12, scale:  2 }),
	openingDebit: numeric("opening_debit", { precision: 12, scale:  2 }),
	type: text(),
	shikanjaId: integer("shikanja_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.shikanjaId],
			foreignColumns: [shikanja.id],
			name: "purchase_parties_shikanja_id_shikanja_id_fk"
		}),
]);

export const purchaseGatePasses = pgTable("purchase_gate_passes", {
	id: serial().primaryKey().notNull(),
	gpNumber: text("gp_number").notNull(),
	date: date().notNull(),
	purchasePartyId: integer("purchase_party_id").notNull(),
	lotNumber: text("lot_number").notNull(),
	remarks: text(),
	purchaseBillId: integer("purchase_bill_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pgp_bill").using("btree", table.purchaseBillId.asc().nullsLast().op("int4_ops")),
	index("idx_pgp_date").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("idx_pgp_party").using("btree", table.purchasePartyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.purchaseBillId],
			foreignColumns: [purchaseBills.id],
			name: "purchase_gate_passes_purchase_bill_id_purchase_bills_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.purchasePartyId],
			foreignColumns: [purchaseParties.id],
			name: "purchase_gate_passes_purchase_party_id_purchase_parties_id_fk"
		}).onDelete("restrict"),
	unique("purchase_gate_passes_gp_number_unique").on(table.gpNumber),
]);

export const returnBillItems = pgTable("return_bill_items", {
	id: serial().primaryKey().notNull(),
	returnBillId: integer("return_bill_id").notNull(),
	productId: integer("product_id").notNull(),
	qty: numeric({ precision: 10, scale:  3 }),
	gazana: numeric({ precision: 10, scale:  3 }),
	rate: numeric({ precision: 12, scale:  2 }),
	finalRate: numeric("final_rate", { precision: 12, scale:  2 }),
	total: numeric({ precision: 12, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_rb_items_bill").using("btree", table.returnBillId.asc().nullsLast().op("int4_ops")),
	index("idx_rb_items_product").using("btree", table.productId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "return_bill_items_product_id_products_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.returnBillId],
			foreignColumns: [returnBills.id],
			name: "return_bill_items_return_bill_id_return_bills_id_fk"
		}).onDelete("cascade"),
]);

export const paymentReceives = pgTable("payment_receives", {
	id: serial().primaryKey().notNull(),
	prNumber: text("pr_number").notNull(),
	date: date().notNull(),
	salePartyId: integer("sale_party_id").notNull(),
	paymentMode: text("payment_mode"),
	amount: numeric({ precision: 12, scale:  2 }),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pr_date").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("idx_pr_party").using("btree", table.salePartyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.salePartyId],
			foreignColumns: [saleParties.id],
			name: "payment_receives_sale_party_id_sale_parties_id_fk"
		}).onDelete("restrict"),
	unique("payment_receives_pr_number_unique").on(table.prNumber),
	check("payment_receives_mode_check", sql`payment_mode = ANY (ARRAY['Cash'::text, 'Bank'::text])`),
]);
