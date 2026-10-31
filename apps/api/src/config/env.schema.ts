import { z } from 'zod';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export const DATABASE_SSL_MODES = ['disable', 'require', 'no-verify'] as const;

/**
 * Returns a human-readable problem, or `undefined` when the value is acceptable.
 * The message never includes the value itself: DATABASE_URL carries a password.
 */
function checkPostgresUrl(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'must be a valid postgres:// or postgresql:// URL';
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    return 'must use the postgres:// or postgresql:// scheme';
  }
  if (!url.hostname) return 'must include a host name';
  if (url.searchParams.has('sslmode') || url.searchParams.has('ssl')) {
    // The pg driver lets URL parameters silently override explicit SSL options, and its
    // interpretation of sslmode=require has changed between releases. One explicit setting
    // (DATABASE_SSL) is deterministic.
    return 'must not contain sslmode or ssl parameters; set DATABASE_SSL instead';
  }
  return undefined;
}

/** Splits a comma-separated origin list and reports every malformed entry. */
export function parseOriginList(raw: string): { origins: string[]; problems: string[] } {
  const origins: string[] = [];
  const problems: string[] = [];
  for (const entry of raw.split(',').map((part) => part.trim())) {
    if (entry === '') continue;
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      problems.push(`"${entry}" is not a valid origin`);
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      problems.push(`"${entry}" must use http or https`);
    } else if (url.origin !== entry) {
      problems.push(
        `"${entry}" must be a bare origin (scheme, host, optional port; no path or trailing slash)`,
      );
    } else {
      origins.push(entry);
    }
  }
  return { origins, problems };
}

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

const portNumber = z.coerce.number().int().min(1).max(65535);
const positiveInt = (max: number) => z.coerce.number().int().min(1).max(max);

/** Every environment variable the API reads, before cross-field rules are applied. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default('development'),
  HOST: z.string().min(1).optional(),
  PORT: portNumber.default(4000),
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  ENABLE_API_DOCS: booleanFlag.optional(),
  DATABASE_URL: z.string({ error: 'is required' }).superRefine((value, ctx) => {
    const problem = checkPostgresUrl(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  }),
  DATABASE_SSL: z.enum(DATABASE_SSL_MODES).optional(),
  DATABASE_POOL_MAX: positiveInt(100).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: positiveInt(60_000).default(5_000),
  DATABASE_QUERY_TIMEOUT_MS: positiveInt(120_000).default(10_000),
});

/** The subset needed by tools that only talk to the database (the migration runner). */
export const databaseEnvSchema = baseEnvSchema.pick({
  NODE_ENV: true,
  DATABASE_URL: true,
  DATABASE_SSL: true,
  DATABASE_POOL_MAX: true,
  DATABASE_CONNECTION_TIMEOUT_MS: true,
  DATABASE_QUERY_TIMEOUT_MS: true,
});

/** Rules that depend on more than one variable. */
export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.CORS_ALLOWED_ORIGINS !== undefined) {
    const { problems } = parseOriginList(env.CORS_ALLOWED_ORIGINS);
    for (const problem of problems) {
      ctx.addIssue({ code: 'custom', path: ['CORS_ALLOWED_ORIGINS'], message: problem });
    }
  }

  if (env.NODE_ENV === 'production') {
    const origins = env.CORS_ALLOWED_ORIGINS
      ? parseOriginList(env.CORS_ALLOWED_ORIGINS).origins
      : [];
    if (origins.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'is required in production and must list at least one origin',
      });
    }
    for (const origin of origins) {
      if (!origin.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ALLOWED_ORIGINS'],
          message: `"${origin}" must use https in production`,
        });
      }
    }
  }
});

export type Env = z.infer<typeof envSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
