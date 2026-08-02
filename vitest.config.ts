import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Count every source file, not only the ones a test happens to import:
      // otherwise a new untested module leaves the percentage untouched and
      // the thresholds below stop being a ratchet.
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/components/ui/**", // shadcn-ui primitives, vendored as-is
        "src/data/**", // mock fixtures
        "src/i18n/locales/**", // translation resources
        "src/test/**",
        "src/main.tsx",
        "**/__tests__/**",
        "**/*.d.ts",
      ],
      reporter: ["text-summary", "lcov"],
      // A floor, not a target — see #115. Raise these as coverage grows;
      // they exist to stop it sliding back.
      thresholds: {
        statements: 11,
        branches: 65,
        functions: 35,
        lines: 11,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
