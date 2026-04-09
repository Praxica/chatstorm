const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

// Shared settings applied to both project configs
const sharedConfig = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@dicebear/(.*)$': '<rootDir>/__tests__/mocks/dicebear.ts',
    '^@clerk/nextjs/server$': '<rootDir>/__tests__/mocks/clerk.ts',
    '^ai$': '<rootDir>/__tests__/mocks/ai-sdk.ts',
  },
}

// next/jest returns an async factory; we resolve it then build projects
module.exports = async () => {
  const baseConfig = await createJestConfig(sharedConfig)()

  return {
    ...baseConfig,
    // Override testMatch at root to prevent double-running
    testMatch: [],
    projects: [
      // ── Unit tests ─────────────────────────────────────────
      // Pure logic tests — no DB, no external services.
      {
        ...baseConfig,
        displayName: 'unit',
        testMatch: ['**/__tests__/unit/**/*.test.ts'],
      },

      // ── Integration tests ──────────────────────────────────
      // Tests that need a real database (Testcontainers).
      {
        ...baseConfig,
        displayName: 'integration',
        testMatch: [
          '**/__tests__/api/**/*.test.ts',
          '**/__tests__/chat/**/*.test.ts',
          '**/__tests__/integration/**/*.test.ts',
        ],
        globalSetup: '<rootDir>/__tests__/integration/globalSetup.cjs',
        globalTeardown: '<rootDir>/__tests__/integration/globalTeardown.cjs',
        setupFilesAfterEnv: [
          '<rootDir>/__tests__/integration/setup.ts',
          ...(baseConfig.setupFilesAfterEnv || []),
        ],
      },
    ],
  }
}
