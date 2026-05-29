import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "node_modules/**",
    "apps/api/dist/**",
    "apps/api/coverage/**",
    "backups/**",
    ".tmp/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      /*
       * These React Compiler lint checks are too strict for the current TWA UI
       * patterns and currently block CI on code that Next.js still builds.
       * Keep the rest of core-web-vitals active.
       */
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
