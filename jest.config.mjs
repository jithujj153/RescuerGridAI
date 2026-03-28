/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/app/api/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/types/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover"],
};

export default config;
