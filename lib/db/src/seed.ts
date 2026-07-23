/**
 * Seed: number_series
 *
 * Architecture decision AD-09: one row per document type, current_number starts at 0.
 * First document of each type will increment to 1 before assignment.
 *
 * Run after migrations have been applied:
 *   pnpm --filter @workspace/db run seed
 */

import { db, pool } from "./index";
import { numberSeriesTable } from "./schema";

const NUMBER_SERIES_ROWS = [
  { documentType: "Purchase Gate Pass", prefix: "PGP", currentNumber: 0 },
  { documentType: "Sale Gate Pass",     prefix: "SGP", currentNumber: 0 },
  { documentType: "Return Gate Pass",   prefix: "RGP", currentNumber: 0 },
  { documentType: "Purchase Bill",      prefix: "PB",  currentNumber: 0 },
  { documentType: "Sales Bill",         prefix: "SB",  currentNumber: 0 },
  { documentType: "Return Bill",        prefix: "RB",  currentNumber: 0 },
  { documentType: "Payment Receive",    prefix: "PR",  currentNumber: 0 },
  { documentType: "Payment Paid",       prefix: "PP",  currentNumber: 0 },
] as const;

async function seed() {
  console.log("Seeding number_series...");

  await db
    .insert(numberSeriesTable)
    .values(NUMBER_SERIES_ROWS.map((row) => ({ ...row })))
    .onConflictDoNothing({ target: numberSeriesTable.documentType });

  console.log(`✓ Inserted ${NUMBER_SERIES_ROWS.length} number_series rows (skipped any already present).`);
}

seed()
  .then(() => {
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
