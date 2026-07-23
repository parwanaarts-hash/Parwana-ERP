/**
 * Central API error class and Express error-handler middleware.
 *
 * Responsibilities:
 *   - Define ApiError so any code in the request pipeline can throw a
 *     typed error with an explicit HTTP status code.
 *   - Map every known service-layer error class to the correct HTTP status.
 *   - Emit a consistent JSON error envelope: { error, code, issues? }
 *   - Log unrecognised errors at ERROR level before returning 500.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

// Service errors — Purchase Gate Pass
import {
  PurchaseGatePassNotFoundError,
  PurchaseGatePassLinkedToBillError,
  PurchasePartyNotFoundError,
  PurchaseGatePassProductNotFoundError,
  PurchaseGatePassValidationError,
} from "../services/purchaseGatePassService";

// Service errors — Purchase Bill
import {
  PurchaseBillNotFoundError,
  PurchaseBillPartyNotFoundError,
  PurchaseBillGatePassNotFoundError,
  PurchaseBillGatePassPartyMismatchError,
  PurchaseBillValidationError,
} from "../services/purchaseBillService";

// Service errors — Payment Paid
import {
  PaymentPaidNotFoundError,
  PaymentPaidPartyNotFoundError,
  PaymentPaidValidationError,
} from "../services/paymentPaidService";

// Service errors — Sale Gate Pass
import {
  SaleGatePassNotFoundError,
  SaleGatePassLinkedToBillError,
  SalePartyNotFoundError,
  SaleGatePassProductNotFoundError,
  SaleGatePassValidationError,
} from "../services/saleGatePassService";

// Service errors — Sales Bill
import {
  SalesBillNotFoundError,
  SalesBillPartyNotFoundError,
  SalesBillGatePassNotFoundError,
  SalesBillGatePassPartyMismatchError,
  SalesBillValidationError,
} from "../services/salesBillService";

// Service errors — Payment Receive
import {
  PaymentReceiveNotFoundError,
  PaymentReceivePartyNotFoundError,
  PaymentReceiveValidationError,
} from "../services/paymentReceiveService";

// Service errors — Return Gate Pass
import {
  ReturnGatePassNotFoundError,
  ReturnGatePassLinkedToBillError,
  ReturnGatePassPartyNotFoundError,
  ReturnGatePassProductNotFoundError,
  ReturnGatePassValidationError,
} from "../services/returnGatePassService";

// Service errors — Return Bill
import {
  ReturnBillNotFoundError,
  ReturnBillPartyNotFoundError,
  ReturnBillGatePassNotFoundError,
  ReturnBillGatePassPartyMismatchError,
  ReturnBillValidationError,
} from "../services/returnBillService";

// Service errors — Number Series
import { NumberSeriesNotFoundError } from "../services/numberSeriesService";

// ---------------------------------------------------------------------------
// ApiError — thrown by route helpers and converted here into HTTP responses
// ---------------------------------------------------------------------------

/**
 * Throw this anywhere in the request pipeline to produce a specific HTTP
 * response without coupling the caller to Express.
 *
 * @example
 *   throw new ApiError(400, "purchasePartyId must be a positive integer", "INVALID_PARAM");
 */
export class ApiError extends Error {
  constructor(
    /** HTTP status code to send. */
    public readonly statusCode: number,
    message: string,
    /** Machine-readable error code included in the response body. */
    public readonly code: string = "ERROR",
    /** Optional Zod issue list for validation failures. */
    public readonly issues?: unknown[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Error response helper
// ---------------------------------------------------------------------------

function sendError(
  res: Response,
  status: number,
  message: string,
  code: string,
  issues?: unknown[]
): void {
  res.status(status).json({
    error: message,
    code,
    ...(issues && issues.length > 0 ? { issues } : {}),
  });
}

// ---------------------------------------------------------------------------
// Express error-handler middleware (4-argument signature is required)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ---- ApiError (thrown by route helpers) ----------------------------------
  if (err instanceof ApiError) {
    sendError(res, err.statusCode, err.message, err.code, err.issues);
    return;
  }

  // ---- 404 Not Found errors ------------------------------------------------
  if (
    err instanceof PurchaseGatePassNotFoundError ||
    err instanceof PurchaseBillNotFoundError ||
    err instanceof PurchasePartyNotFoundError ||
    err instanceof PurchaseBillPartyNotFoundError ||
    err instanceof PurchaseGatePassProductNotFoundError ||
    err instanceof PurchaseBillGatePassNotFoundError ||
    err instanceof PaymentPaidNotFoundError ||
    err instanceof PaymentPaidPartyNotFoundError ||
    err instanceof SaleGatePassNotFoundError ||
    err instanceof SalePartyNotFoundError ||
    err instanceof SaleGatePassProductNotFoundError ||
    err instanceof SaleGatePassLinkedToBillError ||
    err instanceof SalesBillNotFoundError ||
    err instanceof SalesBillPartyNotFoundError ||
    err instanceof SalesBillGatePassNotFoundError ||
    err instanceof SalesBillGatePassPartyMismatchError ||
    err instanceof PaymentReceiveNotFoundError ||
    err instanceof PaymentReceivePartyNotFoundError ||
    err instanceof ReturnGatePassNotFoundError ||
    err instanceof ReturnGatePassLinkedToBillError ||
    err instanceof ReturnGatePassPartyNotFoundError ||
    err instanceof ReturnGatePassProductNotFoundError ||
    err instanceof ReturnBillNotFoundError ||
    err instanceof ReturnBillPartyNotFoundError ||
    err instanceof ReturnBillGatePassNotFoundError ||
    err instanceof ReturnBillGatePassPartyMismatchError
  ) {
    sendError(res, 404, err.message, err.name);
    return;
  }

  // ---- 400 Bad Request — validation errors from services -------------------
  if (
    err instanceof PurchaseGatePassValidationError ||
    err instanceof PurchaseBillValidationError ||
    err instanceof PaymentPaidValidationError ||
    err instanceof SaleGatePassValidationError ||
    err instanceof SalesBillValidationError ||
    err instanceof PaymentReceiveValidationError ||
    err instanceof ReturnGatePassValidationError ||
    err instanceof ReturnBillValidationError
  ) {
    sendError(res, 400, err.message, err.name);
    return;
  }

  // ---- 409 Conflict --------------------------------------------------------
  if (err instanceof PurchaseGatePassLinkedToBillError) {
    sendError(res, 409, err.message, err.name);
    return;
  }

  // ---- 422 Unprocessable Entity — semantic cross-field errors --------------
  if (err instanceof PurchaseBillGatePassPartyMismatchError) {
    sendError(res, 422, err.message, err.name);
    return;
  }

  // ---- 500 Server configuration errors ------------------------------------
  if (err instanceof NumberSeriesNotFoundError) {
    logger.error({ err }, "Number series row missing — seed may not have been applied");
    sendError(
      res,
      500,
      "Server configuration error: document number series is not initialised",
      err.name
    );
    return;
  }

  // ---- PostgreSQL unique-constraint violation (code 23505) ----------------
  // Happens when a document number collides (extremely rare — number series
  // counter drift) or when any other unique index is violated.
  if (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  ) {
    sendError(
      res,
      409,
      "A record with this unique identifier already exists",
      "DUPLICATE_KEY"
    );
    return;
  }

  // ---- Unknown / unexpected errors ----------------------------------------
  logger.error({ err }, "Unhandled error in request pipeline");
  sendError(res, 500, "An unexpected error occurred", "INTERNAL_ERROR");
}
