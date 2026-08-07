import js from "@eslint/js";
import globals from "globals";

export default [
  {
    // Contratos .ts são tipagem; o parser do ESLint aqui é só JS.
    ignores: ["src/generated/**", "node_modules/**", "**/*.ts"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "tests/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
