import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "android", "ios", "boilerplate", "node_modules"] },
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
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "no-empty": "off",
      "no-useless-assignment": "off",
      "prefer-const": "off",
    },
  },
  // Guardrail: keep raw @capacitor/* imports inside the bridge layer.
  // Feature code must go through `@/lib/bridge` or `@/lib/native/*` wrappers.
  // Flipped to "error" 2026-06-08 — only allowed escape hatches are the
  // bridge layer, the platform shim, and tests.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/bridge/**",
      "src/lib/native/**",
      "src/lib/platform.ts",
      "src/**/*.test.{ts,tsx}",
      "src/test/**",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@capacitor/*", "@capgo/*"],
          message: "Import via @/lib/bridge or add a wrapper in src/lib/native/. See docs/briefs/02-07-best-practices-and-plugins.md",
        }],
      }],
    },
  },


);
