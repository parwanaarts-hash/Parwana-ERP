/**
 * Purchase Bill routes
 *
 * Mounted at: /api/purchase-bills
 *
 * Endpoints:
 *   GET    /                 — list (with optional filters)
 *   POST   /                 — create a new purchase bill
 *   GET    /:id              — get a single bill with items and linked gate pass IDs
 *   PUT    /:id              — update header and/or gate pass selection
 *   DELETE /:id              — reverse financial ledger and delete
 *
 * All business logic lives in purchaseBillService.
 * Routes are responsible only for: parsing, calling the service, responding.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseQuery, parseId } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createPurchaseBill,
  updatePurchaseBill,
  deletePurchaseBill,
  getPurchaseBill,
  getPurchaseBillByNumber,
  listPurchaseBills,
} from "../services/purchaseBillService";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas — request validation only
// ---------------------------------------------------------------------------

const CreateBody = z.object({
  purchasePartyId:    z.number().int().positive(),
  billDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "billDate must be YYYY-MM-DD" }),
  gatePassIds:        z.array(z.number().int().positive()).min(1, { message: "At least one gate pass ID is required" }),
  supplierBillNumber: z.string().nullable().optional(),
  lotNumber:          z.string().nullable().optional(),
  // billAmount: non-negative (0 is valid — bill saved without amount)
  billAmount:         z.number().min(0).nullable().optional(),
  remarks:            z.string().nullable().optional(),
});

const UpdateBody = z.object({
  billDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "billDate must be YYYY-MM-DD" }).optional(),
  gatePassIds:        z.array(z.number().int().positive()).min(1, { message: "gatePassIds cannot be empty when provided" }).optional(),
  supplierBillNumber: z.string().nullable().optional(),
  lotNumber:          z.string().nullable().optional(),
  billAmount:         z.number().min(0).nullable().optional(),
  remarks:            z.string().nullable().optional(),
});

const ListQuery = z.object({
  purchasePartyId: z.coerce.number().int().positive().optional(),
  fromDate:        z.string().optional(),
  toDate:          z.string().optional(),
  limit:           z.coerce.number().int().positive().max(500).optional(),
  offset:          z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// GET /number/:billNumber  — get by document number (must precede /:id)
// ---------------------------------------------------------------------------

router.get(
  "/number/:billNumber",
  asyncHandler(async (req, res) => {
    const billNumber = String(req.params.billNumber);
    const result = await getPurchaseBillByNumber(billNumber);

    if (result === null) {
      throw new ApiError(404, `Purchase Bill not found: billNumber=${billNumber}`, "PurchaseBillNotFoundError");
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
    const results = await listPurchaseBills(query);
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

    // Zod min(1) guarantees the array is non-empty; the cast satisfies the
    // service's non-empty-tuple type without duplicating the runtime check.
    const result = await createPurchaseBill({
      purchasePartyId:    body.purchasePartyId,
      billDate:           body.billDate,
      gatePassIds:        body.gatePassIds as [number, ...number[]],
      supplierBillNumber: body.supplierBillNumber,
      lotNumber:          body.lotNumber,
      billAmount:         body.billAmount,
      remarks:            body.remarks,
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
    const result = await getPurchaseBill(id);

    if (result === null) {
      throw new ApiError(404, `Purchase Bill not found: id=${id}`, "PurchaseBillNotFoundError");
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

    const result = await updatePurchaseBill(id, {
      billDate:           body.billDate,
      gatePassIds:        body.gatePassIds as [number, ...number[]] | undefined,
      supplierBillNumber: body.supplierBillNumber,
      lotNumber:          body.lotNumber,
      billAmount:         body.billAmount,
      remarks:            body.remarks,
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
    await deletePurchaseBill(id);
    res.sendStatus(204);
  })
);

export default router;
