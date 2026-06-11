import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    exclude: ["tests/e2e/**"],
    include: ["tests/**/*.spec.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
