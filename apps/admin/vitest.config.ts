/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./src") + "/",
    },
  },
  test: {
    name: "admin",
    root: __dirname,
    environment: "happy-dom",
    globals: true,
    reporters: ["default", "junit"],
    outputFile: {
      junit: "../../junit-admin.xml",
    },
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    server: {
      deps: {
        inline: ["@safetywallet/ui"],
      },
    },
    alias: {
      "@/": path.resolve(__dirname, "./src") + "/",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/__tests__/**",
        "src/app/layout.tsx",
        "src/hooks/use-admin-api.ts",
        "src/hooks/use-api-base.ts",
        "src/hooks/use-api.ts",
        "src/hooks/use-education-api-types.ts",
        "src/hooks/use-education-api.ts",
        "src/hooks/use-points-api.ts",
        "src/lib/utils.ts",
        "src/types/vote.ts",
        "src/app/education/components/education-types.ts",
        "src/app/education/components/quizzes-tab/types.ts",
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
