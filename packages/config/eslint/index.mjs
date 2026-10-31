import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Paths that are never linted in any package.
 * Build output and generated files are not source.
 */
export const sharedIgnores = globalIgnores([
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/coverage/**',
  '**/playwright-report/**',
  '**/test-results/**',
]);

/**
 * Preset for Node.js / TypeScript packages (API, shared contracts).
 *
 * Uses the type-aware `recommendedTypeChecked` rule set: on a backend,
 * `no-floating-promises` and `no-misused-promises` catch real defects
 * (unhandled rejections, async callbacks passed where void is expected).
 *
 * Plain JS/MJS and the `*.config.ts` files sit outside each package's
 * tsconfig, so type-aware rules are disabled for them.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function nodeConfig({ tsconfigRootDir }) {
  return defineConfig([
    sharedIgnores,
    js.configs.recommended,
    {
      files: ['**/*.ts'],
      extends: [tseslint.configs.recommendedTypeChecked],
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/consistent-type-assertions': [
          'error',
          { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
        ],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}', '**/*.config.ts'],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: { globals: { ...globals.node } },
    },
    prettier,
  ]);
}

/**
 * Preset for plain ESM config packages with no TypeScript.
 */
export function scriptConfig() {
  return defineConfig([
    sharedIgnores,
    js.configs.recommended,
    { languageOptions: { globals: { ...globals.node } } },
    prettier,
  ]);
}

export { defineConfig, globalIgnores, js, prettier, globals, tseslint };
