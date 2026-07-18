import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "supabase/functions", "src/__tests__"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
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

      // ---------- Stricter (anti-bug) ----------
      // Erros novos: regras seguras que pegam bugs sem quebrar build atual
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-throw-literal": "error",
      "prefer-const": "error",

      // Cleanup concluído (392 -> 0 warnings) — regras travadas como error
      // para impedir que a dívida técnica volte a se acumular.
      "no-param-reassign": ["error", { props: false }],
      "no-implicit-coercion": ["error", { boolean: false }],
      "no-return-await": "error",
      "no-misleading-character-class": "error",
      "no-empty": "error",
      "prefer-rest-params": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-require-imports": "error",
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  eslintConfigPrettier
);
