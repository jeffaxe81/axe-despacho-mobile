import {defineConfig} from "vitest/config";
export default defineConfig({
  test:{
    include:["scripts/quality/mobile10b.campaign.ts"],
    maxWorkers:1,
    minWorkers:1,
    testTimeout:900_000,
    hookTimeout:30_000
  }
});
