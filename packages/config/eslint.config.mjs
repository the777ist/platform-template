// Shared ESLint flat config for all JS/TS workspaces.
// Consume from a package's eslint.config.mjs:
//   export { default } from "@platform/config/eslint";
import expoConfig from "eslint-config-expo/flat.js";

export default [
  ...expoConfig,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.expo/**",
      "**/release/**",
      "**/renderer/**",
      "**/dist-main/**",
      // Generated API clients are lint-exempt: they are machine output.
      "**/*.gen.ts",
    ],
  },
];
