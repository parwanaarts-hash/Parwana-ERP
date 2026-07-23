/**
 * Dashboard routes — Read-Only
 *
 * Mounted at: /api/dashboard
 *
 * Endpoints:
 *   GET /summary              — master counts + current stock totals
 *   GET /today                — document counts dated today
 *   GET /outstanding          — total customer receivable and supplier payable
 *   GET /recent-transactions  — latest N rows per transaction type
 *   GET /low-stock            — products at or below a stock threshold
 *
 * All business logic lives in dashboardService.
 * Routes: parse → call service → respond.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { parseQuery } from "../lib/validate";
import {
  getDashboardSummary,
  getTodaySummary,
  getOutstandingSummary,
  getRecentTransactions,
  getLowStock,
} from "../services/dashboardService";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /summary
// ---------------------------------------------------------------------------

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const result = await getDashboardSummary();
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /today
// ---------------------------------------------------------------------------

router.get(
  "/today",
  asyncHandler(async (_req, res) => {
    const result = await getTodaySummary();
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /outstanding
// ---------------------------------------------------------------------------

router.get(
  "/outstanding",
  asyncHandler(async (_req, res) => {
    const result = await getOutstandingSummary();
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /recent-transactions
// ---------------------------------------------------------------------------

const RecentQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

router.get(
  "/recent-transactions",
  asyncHandler(async (req, res) => {
    const q = parseQuery(RecentQuery, req);
    const result = await getRecentTransactions(q.limit ?? 10);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /low-stock
// ---------------------------------------------------------------------------

const LowStockQuery = z.object({
  threshold: z.coerce.number().min(0).optional(),
  limit:     z.coerce.number().int().positive().max(500).optional(),
  offset:    z.coerce.number().int().min(0).optional(),
});

router.get(
  "/low-stock",
  asyncHandler(async (req, res) => {
    const q = parseQuery(LowStockQuery, req);
    const result = await getLowStock(
      q.threshold ?? 0,
      q.limit     ?? 50,
      q.offset    ?? 0,
    );
    res.json(result);
  })
);

export default router;
