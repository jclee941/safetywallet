/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "worker",
    environment: "happy-dom",
    globals: true,
    reporters: ["default", "junit"],
    outputFile: {
      junit: "../../junit-worker.xml",
    },
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.json",
        "src/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/app/layout.tsx",
        "src/hooks/use-api-base.ts",
        "src/hooks/use-api.ts",
        "src/i18n/index.ts",
        "src/lib/utils.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
