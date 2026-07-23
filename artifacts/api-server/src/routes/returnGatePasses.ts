/**
 * Return Gate Pass routes
 *
 * Mounted at: /api/return-gate-passes
 *
 * Endpoints:
 *   GET    /number/:gpNumber  — get by document number (must precede /:id)
 *   GET    /                  — list (with optional filters)
 *   POST   /                  — create a new return gate pass
 *   GET    /:id               — get a single gate pass with items
 *   PUT    /:id               — update header and/or items
 *   DELETE /:id               — reverse Fresh stock and delete
 *
 * All business logic lives in returnGatePassService.
 * Routes are responsible only for: parsing, calling the service, responding.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseQuery, parseId } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createReturnGatePass,
  updateReturnGatePass,
  deleteReturnGatePass,
  getReturnGatePass,
  getReturnGatePassByNumber,
  listReturnGatePasses,
  type ReturnGatePassItemInput,
} from "../services/returnGatePassService";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas — request validation only (not shared with api-zod package)
// ---------------------------------------------------------------------------

const ItemSchema = z.object({
  productId:  z.number().int().positive(),
  qty:        z.number().positive().nullable().optional(),
  returnType: z.enum(["Fresh", "B Mall"]).nullable().optional(),
});

const CreateBody = z.object({
  salePartyId: z.number().int().positive(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }),
  remarks:     z.string().nullable().optional(),
  items:       z.array(ItemSchema).min(1, { message: "At least one item is required" }),
});

const UpdateBody = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }).optional(),
  remarks: z.string().nullable().optional(),
  items:   z.array(ItemSchema).min(1, { message: "At least one item is required when items are provided" }).optional(),
});

const ListQuery = z.object({
  salePartyId:  z.coerce.number().int().positive().optional(),
  fromDate:     z.string().optional(),
  toDate:       z.string().optional(),
  // Query strings are always text — coerce "true"/"false" to boolean.
  unlinkedOnly: z.string().transform((v) => v === "true").optional(),
  limit:        z.coerce.number().int().positive().max(500).optional(),
  offset:       z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// GET /number/:gpNumber  — get by document number (must precede /:id)
// ---------------------------------------------------------------------------

router.get(
  "/number/:gpNumber",
  asyncHandler(async (req, res) => {
    const gpNumber = String(req.params.gpNumber);
    const result = await getReturnGatePassByNumber(gpNumber);

    if (result === null) {
      throw new ApiError(404, `Return Gate Pass not found: gpNumber=${gpNumber}`, "ReturnGatePassNotFoundError");
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
    const results = await listReturnGatePasses(query);
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

    const result = await createReturnGatePass({
      salePartyId: body.salePartyId,
      date:        body.date,
      remarks:     body.remarks,
      items:       body.items as [ReturnGatePassItemInput, ...ReturnGatePassItemInput[]],
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
    const result = await getReturnGatePass(id);

    if (result === null) {
      throw new ApiError(404, `Return Gate Pass not found: id=${id}`, "ReturnGatePassNotFoundError");
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

    const result = await updateReturnGatePass(id, {
      date:    body.date,
      remarks: body.remarks,
      items:   body.items as [ReturnGatePassItemInput, ...ReturnGatePassItemInput[]] | undefined,
    });

    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// DELETE /:id  — delete (reverses Fresh stock ledger, removes document)
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await deleteReturnGatePass(id);
    res.sendStatus(204);
  })
);

export default router;
