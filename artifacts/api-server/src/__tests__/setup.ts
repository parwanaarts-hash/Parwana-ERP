/**
 * Vitest setup file — runs before every test FILE (not every test).
 * Responsible for:
 *   1. Seeding the number_series table (idempotent, skips existing rows).
 *   2. Nothing else — pool teardown is handled by the fork process exiting.
 */

import { beforeAll } from "vitest";
import { ensureNumberSeries } from "./helpers";

beforeAll(async () => {
  await ensureNumberSeries();
});
