import { defineConfig } from "vitest/config";

/** Kept outside the routine 3,216-test suite and Android debug builds.
 * The dedicated matrix job selects one million cases per shard. */
export default defineConfig({
  test: {
    include: ["scripts/quality/mobileTenMillion.fuzz.ts"],
    testTimeout: 300_000,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
