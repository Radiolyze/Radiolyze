import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import i18next from "eslint-plugin-i18next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // The i18n guard from #117. Without it the stock of hardcoded German grows
  // back faster than the sweeps remove it — the issue was reopened four times
  // for exactly that reason.
  //
  // Scoped to `src/components/**` and set to "warn" deliberately: that is where
  // user-facing copy lives, and a blocking rule on a codebase that still has
  // untranslated corners (`src/config/viewer.ts`, `src/pages/**`) would have to
  // be landed with a wall of suppressions. Tighten to "error", and widen the
  // scope, once those are done.
  {
    files: ["src/components/**/*.{ts,tsx}"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "warn",
        {
          // JSX text only, so className/id/style props are not flagged.
          mode: "jsx-text-only",
          // Also check template literals — `Mindestens 10 erforderlich, ${n}`
          // is display copy just as much as a plain string is.
          "should-validate-template": true,
          // <kbd> holds physical key names (Esc, Scroll, Shift+LMB) and <code>
          // holds identifiers — neither is translated in any language. Keep
          // the plugin's own <Trans> exclusion, whose children are the markup
          // of an already-translated key.
          "jsx-components": { exclude: ["Trans", "kbd", "code"] },
          message: "Hardcoded display string — move it into src/i18n/locales (#117).",
        },
      ],
    },
  },
  {
    // Fixtures and stories describe data, not UI copy.
    files: ["src/components/**/*.{test,spec}.{ts,tsx}", "src/components/**/__tests__/**"],
    rules: { "i18next/no-literal-string": "off" },
  },
);
