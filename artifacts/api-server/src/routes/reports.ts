/**
 * Report routes — Read-Only Registers
 *
 * Mounted at: /api/reports
 *
 * Endpoints:
 *   GET /purchase-register        — Purchase Bills register
 *   GET /sales-register           — Sales Bills register
 *   GET /return-register          — Return Bills register
 *   GET /payment-receive-register — Payment Receives register
 *   GET /payment-paid-register    — Payment Paids register
 *
 * All endpoints accept the same optional query parameters:
 *   fromDate   string   — inclusive start date (YYYY-MM-DD)
 *   toDate     string   — inclusive end date   (YYYY-MM-DD)
 *   partyId    number   — filter to one party
 *   docNumber  string   — substring match on document number (case-insensitive)
 *   limit      number   — page size (default 50, max 500)
 *   offset     number   — page offset (default 0)
 *
 * All business logic lives in reportService.
 * Routes are responsible only for: parsing, calling the service, responding.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseQuery } from "../lib/validate";
import {
  paymentPaidRegister,
  paymentReceiveRegister,
  purchaseRegister,
  returnRegister,
  salesRegister,
} from "../services/reportService";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Shared query schema — all five registers use the same filters
// ---------------------------------------------------------------------------

const RegisterQuery = z.object({
  fromDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "fromDate must be YYYY-MM-DD" }).optional(),
  toDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "toDate must be YYYY-MM-DD" }).optional(),
  partyId:   z.coerce.number().int().positive().optional(),
  docNumber: z.string().min(1).optional(),
  limit:     z.coerce.number().int().positive().max(500).optional(),
  offset:    z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// GET /purchase-register
// ---------------------------------------------------------------------------

router.get(
  "/purchase-register",
  asyncHandler(async (req, res) => {
    const q = parseQuery(RegisterQuery, req);
    const result = await purchaseRegister(q);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /sales-register
// ---------------------------------------------------------------------------

router.get(
  "/sales-register",
  asyncHandler(async (req, res) => {
    const q = parseQuery(RegisterQuery, req);
    const result = await salesRegister(q);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /return-register
// ---------------------------------------------------------------------------

router.get(
  "/return-register",
  asyncHandler(async (req, res) => {
    const q = parseQuery(RegisterQuery, req);
    const result = await returnRegister(q);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /payment-receive-register
// ---------------------------------------------------------------------------

router.get(
  "/payment-receive-register",
  asyncHandler(async (req, res) => {
    const q = parseQuery(RegisterQuery, req);
    const result = await paymentReceiveRegister(q);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /payment-paid-register
// ---------------------------------------------------------------------------

router.get(
  "/payment-paid-register",
  asyncHandler(async (req, res) => {
    const q = parseQuery(RegisterQuery, req);
    const result = await paymentPaidRegister(q);
    res.json(result);
  })
);

export default router;
