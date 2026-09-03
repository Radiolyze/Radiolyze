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
  // to, and this backlog grew back between cleanups faster than the sweeps
  // removed it.
  //
  // A warning rather than an error: product names, unit symbols and shortcut
  // hints are reported too, and a blocking rule would be landed with a wall of
  // suppressions. The blocking half of the guard is the resource contract test
  // in src/i18n/__tests__. Tighten to "error" once the remaining findings are
  // either translated or individually silenced with a reason.
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
          // JSX text *and* attributes -- a placeholder or an aria-label is read
          // by a user just as much as body text is.
          mode: "jsx-only",
          // Only the attributes a user actually reads. Everything else --
          // variant, size, side, data-* -- is markup configuration.
          "jsx-attributes": {
            include: ["placeholder", "title", "alt", "aria-label", "label", "subtitle"],
            exclude: [".*"],
          },
          // Template literals are display copy just as much as plain strings:
          // `Mindestens 10 erforderlich, ${n} vorhanden` was one of them.
          "should-validate-template": true,
          // <kbd> holds physical key names (Esc, Shift+LMB) and <code> holds
          // identifiers -- neither is translated in any language. `Trans` is
          // the plugin's own exclusion: its children are the markup of an
          // already-translated key.
          "jsx-components": { exclude: ["Trans", "kbd", "code"] },
          message: "Hardcoded display string -- move it into src/i18n/locales (#117).",
        },
      ],
    },
  },
);
