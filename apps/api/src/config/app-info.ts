import { readFileSync } from 'node:fs';
import { z } from 'zod';

const packageJsonSchema = z.object({ version: z.string().min(1) });

/**
 * Version of the running build, read from package.json so there is a single source of truth.
 * From both `src/config` and `dist/config` the package root is two levels up.
 */
export const APP_VERSION: string = packageJsonSchema.parse(
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')),
).version;

export const SERVICE_NAME = 'smartpack-api' as const;
export const API_PREFIX = 'api/v1';
export const API_DOCS_PATH = 'api/docs';
