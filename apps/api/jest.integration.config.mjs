import { baseConfig } from './jest.config.mjs';

/**
 * Integration tests: boot the real Nest application against a real PostgreSQL database.
 * Requires TEST_DATABASE_URL (see docs/DEVELOPMENT_SETUP.md). Slower tests need a longer timeout.
 */
export default {
  ...baseConfig,
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    // See the comment in the shim for why this one dependency is loaded natively.
    '^content-disposition$': '<rootDir>/test/shims/content-disposition.cjs',
  },
  testMatch: ['<rootDir>/test/**/*.integration.spec.ts'],
  testTimeout: 30_000,
};
