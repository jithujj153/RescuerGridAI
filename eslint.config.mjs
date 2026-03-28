import nextConfig from "eslint-config-next";
import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextConfig,
  ...coreWebVitals,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["coverage/**", "e2e/**", "*.config.*"],
  },
];

export default eslintConfig;
