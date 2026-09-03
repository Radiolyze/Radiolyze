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
  // The i18n guard (#117). Everything the user reads goes through `t()`; a
  // literal that reaches the DOM renders in one language whatever the UI is set
  // to. Warning rather than error: the existing English literals (product
  // names, units, shortcut hints) are not worth a blanket rewrite, and the
  // regression test in src/i18n/__tests__ is the half of the guard that blocks.
  {
    files: ["src/components/**/*.tsx", "src/pages/**/*.tsx"],
    // `components/ui` is the vendored shadcn layer -- its literals are
    // structural ("More pages", slot names), and it is regenerated from
    // upstream rather than edited here.
    ignores: ["src/components/ui/**", "**/__tests__/**"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "warn",
        {
          mode: "jsx-only",
          // Only the attributes a user actually reads. Everything else --
          // variant, size, side, data-* -- is markup configuration.
          "jsx-attributes": {
            include: ["placeholder", "title", "alt", "aria-label", "label", "subtitle"],
            exclude: [".*"],
          },
        },
      ],
    },
  },
);
