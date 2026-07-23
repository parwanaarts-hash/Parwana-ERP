/**
 * Category routes
 *
 * Mounted at: /api/categories
 *
 *   GET    /        — list (topLevelOnly, parentId, limit, offset)
 *   POST   /        — create
 *   GET    /:id     — get single
 *   PUT    /:id     — update
 *   DELETE /:id     — delete (blocked if has children or products reference it)
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseId, parseQuery } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../services/categoryService";

const router: IRouter = Router();

const CreateBody = z.object({
  name:     z.string().min(1, { message: "name is required" }).max(255),
  parentId: z.number().int().positive().nullable().optional(),
});

const UpdateBody = z.object({
  name:     z.string().min(1).max(255).optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

const ListQuery = z.object({
  topLevelOnly: z.coerce.boolean().optional(),
  parentId:     z.coerce.number().int().positive().optional(),
  limit:        z.coerce.number().int().positive().max(500).optional(),
  offset:       z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = parseQuery(ListQuery, req);
    res.json(await listCategories(q));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(CreateBody, req);
    res.status(201).json(
      await createCategory({ name: body.name, parentId: body.parentId })
    );
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id     = parseId(req.params.id);
    const result = await getCategory(id);
    if (result === null) throw new ApiError(404, `Category not found: id=${id}`, "CategoryNotFoundError");
    res.json(result);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id   = parseId(req.params.id);
    const body = parseBody(UpdateBody, req);
    res.json(
      await updateCategory(id, { name: body.name, parentId: body.parentId })
    );
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await deleteCategory(id);
    res.sendStatus(204);
  })
);

export default router;
