import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    /**
     * singleFork: all test files run sequentially in one child process.
     * This prevents concurrent DB access from interfering with running-balance
     * assertions and deadlock-sensitive row locking in the services.
     */
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    /**
     * isolate: false — reuse module instances across test files.
     * The `db` pool is a singleton; re-importing it would open a second pool.
     */
    isolate: false,
    sequence: { shuffle: false },
    env: {
      /**
       * NODE_ENV=production prevents logger.ts from loading pino-pretty
       * (which spawns a worker thread that keeps Vitest from exiting cleanly).
       */
      NODE_ENV: "production",
      LOG_LEVEL:  "silent",
    },
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["./src/__tests__/setup.ts"],
  },
  resolve: {
    /**
     * Order matters: the more-specific "@workspace/db/schema" alias must appear
     * before the less-specific "@workspace/db" alias.
     */
    alias: [
      {
        find: "@workspace/db/schema",
        replacement: path.resolve(__dirname, "../../lib/db/src/schema/index.ts"),
      },
      {
        find: "@workspace/db",
        replacement: path.resolve(__dirname, "../../lib/db/src/index.ts"),
      },
      {
        find: "@workspace/api-zod",
        replacement: path.resolve(__dirname, "../../lib/api-zod/src/index.ts"),
      },
    ],
  },
});
