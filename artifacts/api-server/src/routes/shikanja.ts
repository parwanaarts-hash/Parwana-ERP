/**
 * Shikanja routes
 *
 * Mounted at: /api/shikanja
 *
 *   GET    /        — list (search, limit, offset)
 *   POST   /        — create
 *   GET    /:id     — get single
 *   PUT    /:id     — update
 *   DELETE /:id     — delete (blocked if any product references it)
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseId, parseQuery } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createShikanja,
  deleteShikanja,
  getShikanja,
  listShikanja,
  updateShikanja,
} from "../services/shikanjaService";

const router: IRouter = Router();

const CreateBody = z.object({
  name: z.string().min(1, { message: "name is required" }).max(255),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(255).optional(),
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
    res.json(await listShikanja(q));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(CreateBody, req);
    res.status(201).json(await createShikanja({ name: body.name }));
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id     = parseId(req.params.id);
    const result = await getShikanja(id);
    if (result === null) throw new ApiError(404, `Shikanja not found: id=${id}`, "ShikanjaNotFoundError");
    res.json(result);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id   = parseId(req.params.id);
    const body = parseBody(UpdateBody, req);
    res.json(await updateShikanja(id, { name: body.name }));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await deleteShikanja(id);
    res.sendStatus(204);
  })
);

export default router;
