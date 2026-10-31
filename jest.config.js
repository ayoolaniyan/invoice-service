/** @type {import('jest').Config} */
const shared = {
    preset: "ts-jest",
    testEnvironment: "node",
    setupFiles: ["<rootDir>/tests/setup/env.ts"],
};

/** @type {import('jest').Config} */
module.exports = {
    projects: [
        {
            ...shared,
            displayName: "unit",
            testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
        },
        {
            ...shared,
            displayName: "integration",
            testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
            // Starts one in-memory MongoDB for the run; each test file uses its own database
            globalSetup: "<rootDir>/tests/setup/globalSetup.ts",
            globalTeardown: "<rootDir>/tests/setup/globalTeardown.ts",
        },
    ],
    collectCoverageFrom: ["index.ts", "src/**/*.ts", "scripts/**/*.ts"],
    coverageReporters: ["text-summary", "lcov"],
    // index.ts and the scripts' CLI entry points are exercised by running them, not by Jest
    coverageThreshold: {
        "./src/": { statements: 90, branches: 75, functions: 90, lines: 90 },
    },
};
