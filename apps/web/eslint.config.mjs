import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores, prettier, sharedIgnores } from '@smartpack/config/eslint';

export default defineConfig([
  sharedIgnores,
  globalIgnores(['next-env.d.ts']),
  ...nextVitals,
  ...nextTypescript,
  prettier,
]);
