import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler rules:
      // - set-state-in-effect: this codebase legitimately fetches from external
      //   systems in effects and updates state from async callbacks; the rule
      //   produces too many false positives here, so disable it.
      // - incompatible-library: react-hook-form's watch() returns a function
      //   that cannot be memoized safely; this is an expected library pattern.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;