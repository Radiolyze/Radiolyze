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
    // German literals kept growing back faster than they were replaced (#117).
    // A warning rather than an error: it starts on a backlog, and turning it
    // red would only mean disabling it. `jsx-text-only` keeps it to text a user
    // reads — className, test ids and other attributes are not translatable
    // and would bury the real findings.
    //
    // Not covered: `components/ui/**` is vendored shadcn-ui, upstream code we
    // do not translate, and tests assert on the literals they render.
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", "src/components/**/__tests__/**"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": ["warn", { mode: "jsx-text-only" }],
    },
  },
);
