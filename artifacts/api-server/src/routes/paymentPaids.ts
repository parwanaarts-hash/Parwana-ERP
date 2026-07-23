/**
 * Payment Paid routes
 *
 * Mounted at: /api/payment-paids
 *
 * Endpoints:
 *   GET    /number/:ppNumber  — get by document number (must precede /:id)
 *   GET    /                  — list (with optional filters)
 *   POST   /                  — create a new Payment Paid voucher
 *   GET    /:id               — get a single voucher
 *   PUT    /:id               — update header
 *   DELETE /:id               — reverse ledger and delete
 *
 * All business logic lives in paymentPaidService.
 * Routes are responsible only for: parsing, calling the service, responding.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseQuery, parseId } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createPaymentPaid,
  updatePaymentPaid,
  deletePaymentPaid,
  getPaymentPaid,
  getPaymentPaidByNumber,
  listPaymentPaids,
} from "../services/paymentPaidService";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas — request validation only (not shared with api-zod package)
// ---------------------------------------------------------------------------

const CreateBody = z.object({
  purchasePartyId: z.number().int().positive(),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }),
  paymentMode:     z.enum(["Cash", "Bank"]).nullable().optional(),
  // amount: non-negative (0 valid — voucher saved without posting to ledger)
  amount:          z.number().min(0).nullable().optional(),
  remarks:         z.string().nullable().optional(),
});

const UpdateBody = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }).optional(),
  paymentMode: z.enum(["Cash", "Bank"]).nullable().optional(),
  amount:      z.number().min(0).nullable().optional(),
  remarks:     z.string().nullable().optional(),
});

const ListQuery = z.object({
  purchasePartyId: z.coerce.number().int().positive().optional(),
  fromDate:        z.string().optional(),
  toDate:          z.string().optional(),
  limit:           z.coerce.number().int().positive().max(500).optional(),
  offset:          z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// GET /number/:ppNumber  — get by document number (must precede /:id)
// ---------------------------------------------------------------------------

router.get(
  "/number/:ppNumber",
  asyncHandler(async (req, res) => {
    const ppNumber = String(req.params.ppNumber);
    const result = await getPaymentPaidByNumber(ppNumber);

    if (result === null) {
      throw new ApiError(404, `Payment Paid not found: ppNumber=${ppNumber}`, "PaymentPaidNotFoundError");
    }

    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /  — list
// ---------------------------------------------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = parseQuery(ListQuery, req);
    const results = await listPaymentPaids(query);
    res.json(results);
  })
);

// ---------------------------------------------------------------------------
// POST /  — create
// ---------------------------------------------------------------------------

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(CreateBody, req);

    const result = await createPaymentPaid({
      purchasePartyId: body.purchasePartyId,
      date:            body.date,
      paymentMode:     body.paymentMode,
      amount:          body.amount,
      remarks:         body.remarks,
    });

    res.status(201).json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /:id  — get single
// ---------------------------------------------------------------------------

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const result = await getPaymentPaid(id);

    if (result === null) {
      throw new ApiError(404, `Payment Paid not found: id=${id}`, "PaymentPaidNotFoundError");
    }

    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// PUT /:id  — update
// ---------------------------------------------------------------------------

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id   = parseId(req.params.id);
    const body = parseBody(UpdateBody, req);

    const result = await updatePaymentPaid(id, {
      date:        body.date,
      paymentMode: body.paymentMode,
      amount:      body.amount,
      remarks:     body.remarks,
    });

    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// DELETE /:id  — delete (reverses financial ledger, removes document)
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await deletePaymentPaid(id);
    res.sendStatus(204);
  })
);

export default router;
