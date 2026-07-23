/**
 * Request-parsing helpers built on top of Zod.
 *
 * Each helper uses safeParse internally and converts a failed parse into an
 * ApiError(400) so that the global error handler produces a structured 400
 * response with the full Zod issue list.
 *
 * Usage:
 *   const body  = parseBody(MyBodySchema, req);   // typed as z.infer<typeof MyBodySchema>
 *   const query = parseQuery(MyQuerySchema, req);
 *   const id    = parseId(req.params.id);
 */

import type { Request } from "express";
import { ApiError } from "../middlewares/errorHandler";

// ---------------------------------------------------------------------------
// Internal shape — compatible with any Zod schema's safeParse return value
// ---------------------------------------------------------------------------

interface SafeParseSuccess<T> {
  success: true;
  data: T;
}

interface SafeParseError {
  success: false;
  error: { issues: unknown[] };
}

type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseError;

interface ZodLike<T> {
  safeParse: (input: unknown) => SafeParseResult<T>;
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Parses `req.body` against `schema`.
 * Throws ApiError(400) with Zod issues on failure.
 */
export function parseBody<T>(schema: ZodLike<T>, req: Request): T {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new ApiError(
      400,
      "Request body validation failed",
      "VALIDATION_ERROR",
      result.error.issues
    );
  }
  return result.data;
}

/**
 * Parses `req.query` against `schema`.
 * Throws ApiError(400) with Zod issues on failure.
 *
 * Note: all query string values arrive as strings (or string arrays).
 * Use `z.coerce.number()` / `.transform()` in the schema to convert them.
 */
export function parseQuery<T>(schema: ZodLike<T>, req: Request): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw new ApiError(
      400,
      "Query parameter validation failed",
      "VALIDATION_ERROR",
      result.error.issues
    );
  }
  return result.data;
}

/**
 * Converts a route parameter to a positive integer ID.
 *
 * Accepts `string | string[] | undefined` to match Express 5's widened
 * `req.params` type (Express 5 allows array values in params).
 * When an array is received, the first element is used.
 *
 * Throws ApiError(400) if the resolved value is not a valid positive integer.
 *
 * @example
 *   const id = parseId(req.params.id);
 */
export function parseId(param: string | string[] | undefined): number {
  const raw   = Array.isArray(param) ? param[0] : param;
  const id    = parseInt(raw ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(
      400,
      `Invalid ID parameter: "${raw ?? ""}" — must be a positive integer`,
      "INVALID_ID"
    );
  }
  return id;
}
