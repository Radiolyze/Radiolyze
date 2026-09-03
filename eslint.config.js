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
  {
    // i18n guard (#117). Every user-facing string in a component belongs in the
    // resources; without a rule the stock of hardcoded German grows back faster
    // than passes remove it.
    //
    // Deliberately a warning, and deliberately components-only: the remaining
    // literals are a known backlog, and turning them into errors today would
    // block every unrelated change. Tighten to "error" once the count is zero.
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**", // shadcn-ui primitives, vendored as-is
      "src/components/**/__tests__/**", // tests assert on rendered copy
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "warn",
        {
          // Only what a user actually reads: JSX text, and the attributes that
          // are rendered or announced. Everything else (className, ids, test
          // hooks, CSS values) would be noise.
          mode: "jsx-text-only",
          "should-validate-template": true,
          message: "Move this string into the i18n resources (see #117).",
        },
      ],
    },
  },
);
