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
  // #117: keeps hardcoded UI text from growing back. A warning for now — the
  // components below still carry a known backlog, tracked on the issue.
  {
    files: ["src/components/**/*.tsx"],
    ignores: ["src/components/ui/**", "src/components/**/__tests__/**"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "warn",
        {
          mode: "jsx-text-only",
          words: {
            // Patterns are anchored by the plugin, so these match the whole
            // text node. Only formatting glue is exempt: punctuation and
            // digits between interpolations ("%", "/", "(", ":"), and a
            // number with a unit. Everything else is a finding.
            exclude: ["[\\s\\d!-/:-@\\[-`{-~]*", "\\d+\\s*(mm|min|px|%)"],
          },
        },
      ],
    },
  },
);
