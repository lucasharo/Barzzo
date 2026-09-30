module.exports = {
  root: true,
  ignorePatterns: [
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/out/**",
    ".barzzo/**",
    ".vercel/**",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["@typescript-eslint", "@next/next"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: [
        "**/*.config.{js,cjs,mjs,ts}",
        "**/tailwind.preset.js",
        "apps/parceiro/api/**/*.js",
      ],
      env: {
        es2022: true,
        node: true,
      },
      globals: {
        fetch: "readonly",
      },
    },
  ],
};
