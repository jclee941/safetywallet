import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./junit.xml",
    },
    projects: [
      "apps/api/vitest.config.ts",
      "apps/admin/vitest.config.ts",
      "apps/worker/vitest.config.ts",
      "packages/ui/vitest.config.ts",
      "packages/types/vitest.config.ts",
    ],
  },
});
