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
    // i18n guard (#117). The components are translated; without a rule holding
    // the line, hardcoded strings grow back — every audit on this repo has found
    // more of them than the previous one did.
    //
    // Deliberately a *warning*, not an error: a known backlog remains (the
    // viewer toolbars keep a handful of literals, and `AIFindingsOverlay` matches
    // on German word stems, which is classification logic to fix backend-side
    // rather than translate). Turning it into an error is the follow-up once
    // that backlog is empty; until then the warning is what keeps it from
    // growing.
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: [
      // Vendored shadcn-ui primitives. Their only strings are upstream English
      // sr-only labels; rewriting them would fork the components from upstream.
      "src/components/ui/**",
      // Test fixtures render throwaway markup ("left", "rest of the app").
      "src/components/**/__tests__/**",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "warn",
        {
          // Only JSX text and the attributes a user actually reads. Without
          // this the rule reports every className, every `variant="ghost"` and
          // every Tailwind string in the tree, which buries the real findings.
          mode: "jsx-text-only",
          "should-validate-template": false,
        },
      ],
    },
  },
);
