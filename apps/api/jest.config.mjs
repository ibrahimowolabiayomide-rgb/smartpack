/**
 * Unit tests: pure logic, no database, no network.
 * Nest 12 is ESM-only, so Jest runs in ESM mode (see the `test` script's --experimental-vm-modules).
 */
export const baseConfig = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  // Sources import siblings as './x.js' (required by Node ESM); map back to the .ts file.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }],
  },
};

export default {
  ...baseConfig,
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};
