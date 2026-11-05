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
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Stylistic only; apostrophes/quotes in copy are intentional.
      "react/no-unescaped-entities": "off",
      // Listing media are user uploads served from Supabase Storage; plain <img> with lazy loading is intentional.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
