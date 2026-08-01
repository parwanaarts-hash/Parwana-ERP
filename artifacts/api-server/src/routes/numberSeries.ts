import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { numberSeriesTable } from "@workspace/db/schema";
import {
  DOCUMENT_TYPES,
  formatDocumentNumber,
  NumberSeriesNotFoundError,
} from "../services/numberSeriesService";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

/**
 * GET /api/number-series/next/:type
 *
 * Returns the next document number for the given document type WITHOUT
 * reserving or incrementing the counter.  UI-only preview endpoint.
 *
 * :type must be one of the DOCUMENT_TYPES values, URL-encoded.
 *
 * Response: { nextNumber: string }
 */
router.get(
  "/next/:type",
  asyncHandler(async (req, res) => {
    const typeParam = decodeURIComponent(req.params.type ?? "");
    const validType = Object.values(DOCUMENT_TYPES).find((t) => t === typeParam);

    if (!validType) {
      res.status(400).json({ error: `Unknown document type: "${typeParam}"` });
      return;
    }

    const rows = await db
      .select()
      .from(numberSeriesTable)
      .where(eq(numberSeriesTable.documentType, validType));

    if (rows.length === 0) {
      throw new NumberSeriesNotFoundError(typeParam);
    }

    const row = rows[0]!;
    const nextNumber = formatDocumentNumber(row.prefix, row.currentNumber + 1);

    res.json({ nextNumber });
  }),
);

export default router;
