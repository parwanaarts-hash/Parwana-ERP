/**
 * Sale Party routes
 *
 * Mounted at: /api/sale-parties
 *
 *   GET    /        — list (search, limit, offset)
 *   POST   /        — create
 *   GET    /:id     — get single
 *   PUT    /:id     — update
 *   DELETE /:id     — delete (blocked if referenced by transactions)
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseId, parseQuery } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createSaleParty,
  deleteSaleParty,
  getSaleParty,
  listSaleParties,
  updateSaleParty,
} from "../services/salePartyService";

const router: IRouter = Router();

const CreateBody = z.object({
  name:        z.string().min(1, { message: "name is required" }).max(255),
  creditLimit: z.number().min(0).nullable().optional(),
});

const UpdateBody = z.object({
  name:        z.string().min(1).max(255).optional(),
  creditLimit: z.number().min(0).nullable().optional(),
});

const ListQuery = z.object({
  search: z.string().min(1).optional(),
  limit:  z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = parseQuery(ListQuery, req);
    res.json(await listSaleParties(q));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(CreateBody, req);
    res.status(201).json(
      await createSaleParty({ name: body.name, creditLimit: body.creditLimit })
    );
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id     = parseId(req.params.id);
    const result = await getSaleParty(id);
    if (result === null) throw new ApiError(404, `Sale Party not found: id=${id}`, "SalePartyNotFoundError");
    res.json(result);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id   = parseId(req.params.id);
    const body = parseBody(UpdateBody, req);
    res.json(
      await updateSaleParty(id, { name: body.name, creditLimit: body.creditLimit })
    );
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await deleteSaleParty(id);
    res.sendStatus(204);
  })
);

export default router;
