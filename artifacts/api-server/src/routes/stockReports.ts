/**
 * Stock Report routes — Read-Only
 *
 * Mounted at: /api/stock-reports
 *
 * Endpoints:
 *   GET /stock-list                   — current balance per product
 *   GET /product-ledger               — stock movement history (productId required)
 *   GET /purchase-gate-pass-register  — purchase gate passes with party name
 *   GET /sale-gate-pass-register      — sale gate passes with party name
 *   GET /return-gate-pass-register    — return gate passes with party name
 *
 * All business logic lives in stockReportService.
 * Routes are responsible only for: parsing, calling the service, responding.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseQuery } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  stockList,
  productLedger,
  purchaseGatePassRegister,
  saleGatePassRegister,
  returnGatePassRegister,
} from "../services/stockReportService";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Shared date-range + pagination schema fragment
// ---------------------------------------------------------------------------

const DateRangeAndPage = {
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "fromDate must be YYYY-MM-DD" }).optional(),
  toDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "toDate must be YYYY-MM-DD" }).optional(),
  limit:    z.coerce.number().int().positive().max(500).optional(),
  offset:   z.coerce.number().int().min(0).optional(),
};

// ---------------------------------------------------------------------------
// GET /stock-list
// ---------------------------------------------------------------------------

const StockListQuery = z.object({
  productId:  z.coerce.number().int().positive().optional(),
  /** subCategoryId on the product */
  categoryId: z.coerce.number().int().positive().optional(),
  shikanjaId: z.coerce.number().int().positive().optional(),
  limit:      z.coerce.number().int().positive().max(500).optional(),
  offset:     z.coerce.number().int().min(0).optional(),
});

router.get(
  "/stock-list",
  asyncHandler(async (req, res) => {
    const q = parseQuery(StockListQuery, req);
    const result = await stockList(q);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /product-ledger
// ---------------------------------------------------------------------------

const ProductLedgerQuery = z.object({
  productId: z.coerce.number().int().positive({ message: "productId is required and must be a positive integer" }),
  ...DateRangeAndPage,
});

router.get(
  "/product-ledger",
  asyncHandler(async (req, res) => {
    const q = parseQuery(ProductLedgerQuery, req);

    if (!q.productId) {
      throw new ApiError(400, "productId is required", "VALIDATION_ERROR");
    }

    const result = await productLedger(q);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /purchase-gate-pass-register
// ---------------------------------------------------------------------------

const PurchaseGPRegisterQuery = z.object({
  partyId:      z.coerce.number().int().positive().optional(),
  gpNumber:     z.string().min(1).optional(),
  unlinkedOnly: z.coerce.boolean().optional(),
  ...DateRangeAndPage,
});

router.get(
  "/purchase-gate-pass-register",
  asyncHandler(async (req, res) => {
    const q = parseQuery(PurchaseGPRegisterQuery, req);
    const result = await purchaseGatePassRegister(q);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /sale-gate-pass-register
// ---------------------------------------------------------------------------

const SaleGPRegisterQuery = z.object({
  partyId:      z.coerce.number().int().positive().optional(),
  gpNumber:     z.string().min(1).optional(),
  unlinkedOnly: z.coerce.boolean().optional(),
  ...DateRangeAndPage,
});

router.get(
  "/sale-gate-pass-register",
  asyncHandler(async (req, res) => {
    const q = parseQuery(SaleGPRegisterQuery, req);
    const result = await saleGatePassRegister(q);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /return-gate-pass-register
// ---------------------------------------------------------------------------

const ReturnGPRegisterQuery = z.object({
  partyId:      z.coerce.number().int().positive().optional(),
  gpNumber:     z.string().min(1).optional(),
  unlinkedOnly: z.coerce.boolean().optional(),
  ...DateRangeAndPage,
});

router.get(
  "/return-gate-pass-register",
  asyncHandler(async (req, res) => {
    const q = parseQuery(ReturnGPRegisterQuery, req);
    const result = await returnGatePassRegister(q);
    res.json(result);
  })
);

export default router;
