/**
 * Number Series Service
 *
 * Generates the next sequential document number for any supported document type.
 * Each call is atomic — concurrent requests for the same document type are
 * serialised at the database level via SELECT … FOR UPDATE row locking inside
 * a transaction.
 *
 * Formatting: <prefix><4-digit zero-padded number>
 * Examples:   PGP0001  SGP0042  PB0001  PR0099
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { numberSeriesTable } from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Document type constants
// ---------------------------------------------------------------------------

/**
 * Canonical document type strings — must match the values inserted by the seed.
 * Using a const map (instead of an enum) keeps the values as plain strings that
 * are directly comparable to database rows, and gives full TypeScript inference.
 */
export const DOCUMENT_TYPES = {
  PurchaseGatePass: "Purchase Gate Pass",
  SaleGatePass:     "Sale Gate Pass",
  ReturnGatePass:   "Return Gate Pass",
  PurchaseBill:     "Purchase Bill",
  SalesBill:        "Sales Bill",
  ReturnBill:       "Return Bill",
  PaymentReceive:   "Payment Receive",
  PaymentPaid:      "Payment Paid",
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a document type string is requested but has no matching row in
 * the number_series table (e.g. seed was not run, or an invalid string was
 * passed).
 */
export class NumberSeriesNotFoundError extends Error {
  constructor(documentType: string) {
    super(
      `number_series row not found for document type: "${documentType}". ` +
      "Ensure the seed has been applied."
    );
    this.name = "NumberSeriesNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Atomically increments the counter for the given document type and returns
 * the next formatted document number.
 *
 * Atomicity guarantee:
 *   1. Opens a PostgreSQL transaction.
 *   2. Issues SELECT … FOR UPDATE on the specific number_series row — the
 *      database acquires an exclusive row-level lock.  Any concurrent call for
 *      the same document type blocks here until this transaction commits or
 *      rolls back.
 *   3. Increments current_number by 1.
 *   4. Writes the new value back in the same transaction.
 *   5. Commits — lock is released.  The next concurrent caller then proceeds.
 *
 * Result: it is impossible for two concurrent calls to receive the same number.
 *
 * @param documentType - One of the DOCUMENT_TYPES values.
 * @returns Formatted document number, e.g. "PGP0001", "PB0042", "PR0099".
 * @throws NumberSeriesNotFoundError if no seed row exists for the type.
 */
export async function getNextDocumentNumber(
  documentType: DocumentType
): Promise<string> {
  return db.transaction(async (tx) => {
    // Step 1: read and lock the row exclusively.
    // FOR UPDATE prevents any other transaction from reading (with FOR UPDATE)
    // or modifying this row until this transaction completes.
    const rows = await tx
      .select()
      .from(numberSeriesTable)
      .where(eq(numberSeriesTable.documentType, documentType))
      .for("update");

    if (rows.length === 0) {
      throw new NumberSeriesNotFoundError(documentType);
    }

    const row = rows[0]!;
    const nextNumber = row.currentNumber + 1;

    // Step 2: persist the new counter value.
    await tx
      .update(numberSeriesTable)
      .set({
        currentNumber: nextNumber,
        updatedAt: new Date(),
      })
      .where(eq(numberSeriesTable.id, row.id));

    // Step 3: format and return.
    // 4-digit zero-padded: PGP0001, PB0042, PR0099, etc.
    return formatDocumentNumber(row.prefix, nextNumber);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a document number from its components.
 * Always uses 4-digit zero padding regardless of prefix length.
 *
 * @param prefix     - e.g. "PGP", "PB", "PR"
 * @param number     - positive integer, e.g. 1, 42, 99
 * @returns          - e.g. "PGP0001", "PB0042", "PR0099"
 */
export function formatDocumentNumber(prefix: string, number: number): string {
  return `${prefix}${String(number).padStart(4, "0")}`;
}

/**
 * Reads the current counter for a document type WITHOUT incrementing it.
 * Useful for display or diagnostic purposes only — do NOT use this to
 * pre-read a number you intend to assign; use getNextDocumentNumber instead.
 *
 * @param documentType - One of the DOCUMENT_TYPES values.
 * @returns The last-issued formatted number, or null if counter is still 0.
 * @throws NumberSeriesNotFoundError if no seed row exists for the type.
 */
export async function peekCurrentDocumentNumber(
  documentType: DocumentType
): Promise<string | null> {
  const rows = await db
    .select()
    .from(numberSeriesTable)
    .where(eq(numberSeriesTable.documentType, documentType));

  if (rows.length === 0) {
    throw new NumberSeriesNotFoundError(documentType);
  }

  const row = rows[0]!;

  if (row.currentNumber === 0) {
    return null; // no document has been issued yet for this type
  }

  return formatDocumentNumber(row.prefix, row.currentNumber);
}
