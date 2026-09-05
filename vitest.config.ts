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
      //
      // The branches/functions floors were re-anchored for vitest 4 (#194),
      // whose v8 provider remaps coverage through the AST instead of counting
      // raw v8 ranges. That changes what is being counted, not how much of it
      // the same 494 tests reach — the denominators move sharply:
      //
      //   vitest 3          vitest 4
      //   branches   78.72% (1114/1415)   28.77% (1097/3812)
      //   functions  57.44% ( 243/ 423)   34.51% ( 459/1330)
      //   statements 33.53% (5093/15188)  34.07% (1814/5324)
      //
      // Statements and lines were left at 11 through that migration and never
      // caught up with the suite, which meant two thirds of the coverage could
      // have disappeared without the job noticing. Re-anchored 2026-09-03
      // against the measured run (35.03 / 29.11 / 34.73 / 35.46) with roughly
      // one point of slack, so an ordinary refactor does not trip the job but
      // a real regression does. Re-anchor again when coverage moves up.
      thresholds: {
        statements: 34,
        branches: 28,
        functions: 33,
        lines: 34,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
