/**
 * Purchase Gate Pass routes
 *
 * Mounted at: /api/purchase-gate-passes
 *
 * Endpoints:
 *   GET    /                 — list (with optional filters)
 *   POST   /                 — create a new gate pass
 *   GET    /:id              — get a single gate pass with items
 *   PUT    /:id              — update header and/or items
 *   DELETE /:id              — reverse stock and delete
 *
 * All business logic lives in purchaseGatePassService.
 * Routes are responsible only for: parsing, calling the service, responding.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseQuery, parseId } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createPurchaseGatePass,
  updatePurchaseGatePass,
  deletePurchaseGatePass,
  getPurchaseGatePass,
  listPurchaseGatePasses,
  type PurchaseGatePassItemInput,
} from "../services/purchaseGatePassService";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas — request validation only (not shared with api-zod package)
// ---------------------------------------------------------------------------

const ItemSchema = z.object({
  productId:   z.number().int().positive(),
  qty:         z.number().positive().nullable().optional(),
  gazana:      z.number().positive().nullable().optional(),
  rate:        z.number().positive().nullable().optional(),
  receivedQty: z.number().positive().nullable().optional(),
});

const CreateBody = z.object({
  purchasePartyId: z.number().int().positive(),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }),
  lotNumber:       z.string().min(1, { message: "lotNumber cannot be empty" }),
  remarks:         z.string().nullable().optional(),
  items:           z.array(ItemSchema).min(1, { message: "At least one item is required" }),
});

const UpdateBody = z.object({
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }).optional(),
  lotNumber: z.string().min(1, { message: "lotNumber cannot be empty" }).optional(),
  remarks:   z.string().nullable().optional(),
  items:     z.array(ItemSchema).min(1, { message: "At least one item is required when items are provided" }).optional(),
});

const ListQuery = z.object({
  purchasePartyId: z.coerce.number().int().positive().optional(),
  fromDate:        z.string().optional(),
  toDate:          z.string().optional(),
  // Query strings are always text — coerce "true"/"false" to boolean.
  unlinkedOnly:    z.string().transform((v) => v === "true").optional(),
  limit:           z.coerce.number().int().positive().max(500).optional(),
  offset:          z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// GET /  — list
// ---------------------------------------------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = parseQuery(ListQuery, req);
    const results = await listPurchaseGatePasses(query);
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

    // The service types require a non-empty tuple; Zod's min(1) guarantees
    // this at runtime so the cast is safe.
    const result = await createPurchaseGatePass({
      purchasePartyId: body.purchasePartyId,
      date:            body.date,
      lotNumber:       body.lotNumber,
      remarks:         body.remarks,
      items:           body.items as [PurchaseGatePassItemInput, ...PurchaseGatePassItemInput[]],
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
    const result = await getPurchaseGatePass(id);

    if (result === null) {
      throw new ApiError(404, `Purchase Gate Pass not found: id=${id}`, "PurchaseGatePassNotFoundError");
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

    const result = await updatePurchaseGatePass(id, {
      date:      body.date,
      lotNumber: body.lotNumber,
      remarks:   body.remarks,
      items:     body.items as [PurchaseGatePassItemInput, ...PurchaseGatePassItemInput[]] | undefined,
    });

    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// DELETE /:id  — delete (reverses stock ledger, removes document)
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await deletePurchaseGatePass(id);
    res.sendStatus(204);
  })
);

export default router;
