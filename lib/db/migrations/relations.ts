import { relations } from "drizzle-orm/relations";
import { shikanja, products, categories, purchaseGatePassItems, purchaseGatePasses, saleParties, saleGatePasses, salesBills, saleGatePassItems, purchaseBillItems, purchaseBills, returnBills, returnGatePasses, returnGatePassItems, purchaseParties, salesBillItems, stockLedgerEntries, paymentPaids, ledgerEntries, returnBillItems, paymentReceives } from "./schema";

export const productsRelations = relations(products, ({one, many}) => ({
	shikanja: one(shikanja, {
		fields: [products.shikanjaId],
		references: [shikanja.id]
	}),
	category: one(categories, {
		fields: [products.subCategoryId],
		references: [categories.id]
	}),
	purchaseGatePassItems: many(purchaseGatePassItems),
	saleGatePassItems: many(saleGatePassItems),
	purchaseBillItems: many(purchaseBillItems),
	returnGatePassItems: many(returnGatePassItems),
	salesBillItems: many(salesBillItems),
	stockLedgerEntries: many(stockLedgerEntries),
	returnBillItems: many(returnBillItems),
}));

export const shikanjaRelations = relations(shikanja, ({many}) => ({
	products: many(products),
	saleParties: many(saleParties),
	purchaseParties: many(purchaseParties),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	products: many(products),
	category: one(categories, {
		fields: [categories.parentId],
		references: [categories.id],
		relationName: "categories_parentId_categories_id"
	}),
	categories: many(categories, {
		relationName: "categories_parentId_categories_id"
	}),
}));

export const purchaseGatePassItemsRelations = relations(purchaseGatePassItems, ({one}) => ({
	product: one(products, {
		fields: [purchaseGatePassItems.productId],
		references: [products.id]
	}),
	purchaseGatePass: one(purchaseGatePasses, {
		fields: [purchaseGatePassItems.purchaseGatePassId],
		references: [purchaseGatePasses.id]
	}),
}));

export const purchaseGatePassesRelations = relations(purchaseGatePasses, ({one, many}) => ({
	purchaseGatePassItems: many(purchaseGatePassItems),
	purchaseBill: one(purchaseBills, {
		fields: [purchaseGatePasses.purchaseBillId],
		references: [purchaseBills.id]
	}),
	purchaseParty: one(purchaseParties, {
		fields: [purchaseGatePasses.purchasePartyId],
		references: [purchaseParties.id]
	}),
}));

export const salePartiesRelations = relations(saleParties, ({one, many}) => ({
	shikanja: one(shikanja, {
		fields: [saleParties.shikanjaId],
		references: [shikanja.id]
	}),
	saleGatePasses: many(saleGatePasses),
	salesBills: many(salesBills),
	returnGatePasses: many(returnGatePasses),
	returnBills: many(returnBills),
	ledgerEntries: many(ledgerEntries),
	paymentReceives: many(paymentReceives),
}));

export const saleGatePassesRelations = relations(saleGatePasses, ({one, many}) => ({
	saleParty: one(saleParties, {
		fields: [saleGatePasses.salePartyId],
		references: [saleParties.id]
	}),
	salesBill: one(salesBills, {
		fields: [saleGatePasses.salesBillId],
		references: [salesBills.id]
	}),
	saleGatePassItems: many(saleGatePassItems),
}));

export const salesBillsRelations = relations(salesBills, ({one, many}) => ({
	saleGatePasses: many(saleGatePasses),
	saleParty: one(saleParties, {
		fields: [salesBills.salePartyId],
		references: [saleParties.id]
	}),
	salesBillItems: many(salesBillItems),
}));

export const saleGatePassItemsRelations = relations(saleGatePassItems, ({one}) => ({
	product: one(products, {
		fields: [saleGatePassItems.productId],
		references: [products.id]
	}),
	saleGatePass: one(saleGatePasses, {
		fields: [saleGatePassItems.saleGatePassId],
		references: [saleGatePasses.id]
	}),
}));

export const purchaseBillItemsRelations = relations(purchaseBillItems, ({one}) => ({
	product: one(products, {
		fields: [purchaseBillItems.productId],
		references: [products.id]
	}),
	purchaseBill: one(purchaseBills, {
		fields: [purchaseBillItems.purchaseBillId],
		references: [purchaseBills.id]
	}),
}));

export const purchaseBillsRelations = relations(purchaseBills, ({one, many}) => ({
	purchaseBillItems: many(purchaseBillItems),
	purchaseParty: one(purchaseParties, {
		fields: [purchaseBills.purchasePartyId],
		references: [purchaseParties.id]
	}),
	purchaseGatePasses: many(purchaseGatePasses),
}));

export const returnGatePassesRelations = relations(returnGatePasses, ({one, many}) => ({
	returnBill: one(returnBills, {
		fields: [returnGatePasses.returnBillId],
		references: [returnBills.id]
	}),
	saleParty: one(saleParties, {
		fields: [returnGatePasses.salePartyId],
		references: [saleParties.id]
	}),
	returnGatePassItems: many(returnGatePassItems),
}));

export const returnBillsRelations = relations(returnBills, ({one, many}) => ({
	returnGatePasses: many(returnGatePasses),
	saleParty: one(saleParties, {
		fields: [returnBills.salePartyId],
		references: [saleParties.id]
	}),
	returnBillItems: many(returnBillItems),
}));

export const returnGatePassItemsRelations = relations(returnGatePassItems, ({one}) => ({
	product: one(products, {
		fields: [returnGatePassItems.productId],
		references: [products.id]
	}),
	returnGatePass: one(returnGatePasses, {
		fields: [returnGatePassItems.returnGatePassId],
		references: [returnGatePasses.id]
	}),
}));

export const purchasePartiesRelations = relations(purchaseParties, ({one, many}) => ({
	purchaseBills: many(purchaseBills),
	paymentPaids: many(paymentPaids),
	ledgerEntries: many(ledgerEntries),
	shikanja: one(shikanja, {
		fields: [purchaseParties.shikanjaId],
		references: [shikanja.id]
	}),
	purchaseGatePasses: many(purchaseGatePasses),
}));

export const salesBillItemsRelations = relations(salesBillItems, ({one}) => ({
	product: one(products, {
		fields: [salesBillItems.productId],
		references: [products.id]
	}),
	salesBill: one(salesBills, {
		fields: [salesBillItems.salesBillId],
		references: [salesBills.id]
	}),
}));

export const stockLedgerEntriesRelations = relations(stockLedgerEntries, ({one}) => ({
	product: one(products, {
		fields: [stockLedgerEntries.productId],
		references: [products.id]
	}),
}));

export const paymentPaidsRelations = relations(paymentPaids, ({one}) => ({
	purchaseParty: one(purchaseParties, {
		fields: [paymentPaids.purchasePartyId],
		references: [purchaseParties.id]
	}),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({one}) => ({
	purchaseParty: one(purchaseParties, {
		fields: [ledgerEntries.purchasePartyId],
		references: [purchaseParties.id]
	}),
	saleParty: one(saleParties, {
		fields: [ledgerEntries.salePartyId],
		references: [saleParties.id]
	}),
}));

export const returnBillItemsRelations = relations(returnBillItems, ({one}) => ({
	product: one(products, {
		fields: [returnBillItems.productId],
		references: [products.id]
	}),
	returnBill: one(returnBills, {
		fields: [returnBillItems.returnBillId],
		references: [returnBills.id]
	}),
}));

export const paymentReceivesRelations = relations(paymentReceives, ({one}) => ({
	saleParty: one(saleParties, {
		fields: [paymentReceives.salePartyId],
		references: [saleParties.id]
	}),
}));