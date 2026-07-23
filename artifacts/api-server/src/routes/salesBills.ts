/**
 * Sales Bill routes
 *
 * Mounted at: /api/sales-bills
 *
 * Endpoints:
 *   GET    /number/:billNumber — get by document number (must precede /:id)
 *   GET    /                   — list (with optional filters)
 *   POST   /                   — create a new sales bill
 *   GET    /:id                — get a single bill with items and linked gate pass IDs
 *   PUT    /:id                — update header and/or gate pass selection
 *   DELETE /:id                — reverse financial ledger and delete
 *
 * All business logic lives in salesBillService.
 * Routes are responsible only for: parsing, calling the service, responding.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseQuery, parseId } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createSalesBill,
  updateSalesBill,
  deleteSalesBill,
  getSalesBill,
  getSalesBillByNumber,
  listSalesBills,
} from "../services/salesBillService";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas — request validation only
// ---------------------------------------------------------------------------

const CreateBody = z.object({
  salePartyId:  z.number().int().positive(),
  billDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "billDate must be YYYY-MM-DD" }),
  gatePassIds:  z.array(z.number().int().positive()).min(1, { message: "At least one gate pass ID is required" }),
  billType:     z.enum(["Cash", "Credit"]).nullable().optional(),
  cashPayment:  z.number().min(0).nullable().optional(),
  bankPayment:  z.number().min(0).nullable().optional(),
  billAmount:   z.number().min(0).nullable().optional(),
  remarks:      z.string().nullable().optional(),
});

const UpdateBody = z.object({
  billDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "billDate must be YYYY-MM-DD" }).optional(),
  gatePassIds:  z.array(z.number().int().positive()).min(1, { message: "gatePassIds cannot be empty when provided" }).optional(),
  billType:     z.enum(["Cash", "Credit"]).nullable().optional(),
  cashPayment:  z.number().min(0).nullable().optional(),
  bankPayment:  z.number().min(0).nullable().optional(),
  billAmount:   z.number().min(0).nullable().optional(),
  remarks:      z.string().nullable().optional(),
});

const ListQuery = z.object({
  salePartyId: z.coerce.number().int().positive().optional(),
  fromDate:    z.string().optional(),
  toDate:      z.string().optional(),
  limit:       z.coerce.number().int().positive().max(500).optional(),
  offset:      z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// GET /number/:billNumber  — get by document number (must precede /:id)
// ---------------------------------------------------------------------------

router.get(
  "/number/:billNumber",
  asyncHandler(async (req, res) => {
    const billNumber = String(req.params.billNumber);
    const result = await getSalesBillByNumber(billNumber);

    if (result === null) {
      throw new ApiError(404, `Sales Bill not found: billNumber=${billNumber}`, "SalesBillNotFoundError");
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
    const results = await listSalesBills(query);
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

    const result = await createSalesBill({
      salePartyId:  body.salePartyId,
      billDate:     body.billDate,
      gatePassIds:  body.gatePassIds as [number, ...number[]],
      billType:     body.billType,
      cashPayment:  body.cashPayment,
      bankPayment:  body.bankPayment,
      billAmount:   body.billAmount,
      remarks:      body.remarks,
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
    const result = await getSalesBill(id);

    if (result === null) {
      throw new ApiError(404, `Sales Bill not found: id=${id}`, "SalesBillNotFoundError");
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

    const result = await updateSalesBill(id, {
      billDate:    body.billDate,
      gatePassIds: body.gatePassIds as [number, ...number[]] | undefined,
      billType:    body.billType,
      cashPayment: body.cashPayment,
      bankPayment: body.bankPayment,
      billAmount:  body.billAmount,
      remarks:     body.remarks,
    });

    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// DELETE /:id  — delete (reverses financial ledger, unlinks gate passes)
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await deleteSalesBill(id);
    res.sendStatus(204);
  })
);

export default router;
