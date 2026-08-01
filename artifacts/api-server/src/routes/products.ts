/**
 * Product routes
 *
 * Mounted at: /api/products
 *
 *   GET    /        — list (search, category, scale, limit, offset)
 *   POST   /        — create
 *   GET    /:id     — get single
 *   PUT    /:id     — update
 *   DELETE /:id     — delete (blocked if referenced by transactions or stock)
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseBody, parseId, parseQuery } from "../lib/validate";
import { ApiError } from "../middlewares/errorHandler";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../services/productService";

const router: IRouter = Router();

const SCALES = ["Ng", "Set", "Suit", "Than"] as const;

const CreateBody = z.object({
  itemCode:      z.string().min(1, { message: "itemCode is required" }).max(100),
  productName:   z.string().min(1, { message: "productName is required" }).max(255),
  urduName:      z.string().max(255).nullable().optional(),
  category:      z.string().max(100).nullable().optional(),
  scale:         z.enum(SCALES).default("Ng"),
  qty:           z.number().int().min(0).default(0),
  stockFactor:   z.number().int().min(0).default(1),
  length:        z.string().nullable().optional(),
  rate:          z.string().nullable().optional(),
  remarks:       z.string().max(500).nullable().optional(),
  subCategoryId: z.number().int().positive().nullable().optional(),
  shikanjaId:    z.number().int().positive().nullable().optional(),
});

const UpdateBody = z.object({
  itemCode:      z.string().min(1).max(100).optional(),
  productName:   z.string().min(1).max(255).optional(),
  urduName:      z.string().max(255).nullable().optional(),
  category:      z.string().max(100).nullable().optional(),
  scale:         z.enum(SCALES).optional(),
  qty:           z.number().int().min(0).optional(),
  stockFactor:   z.number().int().min(0).optional(),
  length:        z.string().nullable().optional(),
  rate:          z.string().nullable().optional(),
  remarks:       z.string().max(500).nullable().optional(),
  subCategoryId: z.number().int().positive().nullable().optional(),
  shikanjaId:    z.number().int().positive().nullable().optional(),
});

const ListQuery = z.object({
  search:   z.string().min(1).optional(),
  category: z.string().optional(),
  scale:    z.enum(SCALES).optional(),
  limit:    z.coerce.number().int().positive().max(500).optional(),
  offset:   z.coerce.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = parseQuery(ListQuery, req);
    res.json(await listProducts(q));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(CreateBody, req);
    res.status(201).json(await createProduct(body));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id     = parseId(req.params.id);
    const result = await getProduct(id);
    if (result === null)
      throw new ApiError(404, `Product not found: id=${id}`, "ProductNotFoundError");
    res.json(result);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id   = parseId(req.params.id);
    const body = parseBody(UpdateBody, req);
    res.json(await updateProduct(id, body));
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await deleteProduct(id);
    res.sendStatus(204);
  }),
);

export default router;
