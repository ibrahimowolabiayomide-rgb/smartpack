import { nodeConfig } from '@smartpack/config/eslint';

export default [
  ...nodeConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The one remaining exemption, as narrow as the code allows:
    //  - one rule only (`no-unsafe-member-access`); every other `no-unsafe-*` rule and
    //    `no-explicit-any` stay on for all tests;
    //  - three files only, the specs that read JSON response bodies (`response.body.data.x`).
    //    Supertest parses a body as `any`; each assertion names the exact property it expects, so a
    //    wrong shape fails the test. Typing every response of these specs would mean duplicating
    //    the API's response types inside the tests.
    // Production code under src/ and every other test file keep the full type-aware rules.
    files: [
      'test/access.integration.spec.ts',
      'test/auth.integration.spec.ts',
      'test/security.integration.spec.ts',
    ],
    rules: { '@typescript-eslint/no-unsafe-member-access': 'off' },
  },
];
