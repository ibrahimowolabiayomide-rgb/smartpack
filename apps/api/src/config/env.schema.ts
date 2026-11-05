import { z } from 'zod';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export const DATABASE_SSL_MODES = ['disable', 'require', 'no-verify'] as const;
export const EMAIL_PROVIDERS = ['none', 'dev-capture', 'smtp', 'brevo'] as const;

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
const httpUrl = z.string().superRefine((value, ctx) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      ctx.addIssue({ code: 'custom', message: 'must use http or https' });
    } else if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
      ctx.addIssue({ code: 'custom', message: 'must be a bare origin without a path' });
    }
  } catch {
    ctx.addIssue({ code: 'custom', message: 'must be a valid URL' });
  }
});
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

  /** Public origin of the web application; used to build links in emails. */
  WEB_APP_URL: httpUrl.optional(),
  /** Number of reverse-proxy hops in front of the API whose X-Forwarded-For is trusted. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  SESSION_IDLE_TIMEOUT_MINUTES: positiveInt(60 * 24 * 30).default(480),
  SESSION_ABSOLUTE_TIMEOUT_HOURS: positiveInt(24 * 90).default(168),
  ARGON2_MEMORY_KIB: positiveInt(1_048_576).default(19_456),
  ARGON2_TIME_COST: positiveInt(20).default(2),
  ARGON2_PARALLELISM: positiveInt(16).default(1),
  INVITATION_TTL_HOURS: positiveInt(24 * 30).default(72),
  PASSWORD_RESET_TTL_MINUTES: positiveInt(60 * 24).default(60),
  EMAIL_VERIFICATION_TTL_HOURS: positiveInt(24 * 14).default(24),

  EMAIL_PROVIDER: z.enum(EMAIL_PROVIDERS).optional(),
  EMAIL_FROM: z.string().min(3).max(200).optional(),
  /** Sender shown to recipients. Used by the Brevo provider; change it here, not in code. */
  EMAIL_SENDER_NAME: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => !/[<>"\r\n]/.test(value), {
      message: 'must not contain angle brackets, quotes or line breaks',
    })
    .optional(),
  EMAIL_SENDER_EMAIL: z.email().max(200).optional(),
  /** Secret. Create it in Brevo under SMTP & API > API keys. Never logged. */
  BREVO_API_KEY: z.string().min(20).max(500).optional(),
  /** Test-only override of the Brevo API origin; refused in production. */
  BREVO_API_BASE_URL: httpUrl.optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: portNumber.optional(),
  SMTP_SECURE: booleanFlag.optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),

  RATE_LIMIT_DISABLED: booleanFlag.optional(),
  /** Multiplies every rate-limit allowance (for example 2 doubles them). */
  RATE_LIMIT_SCALE: z.coerce.number().min(0.1).max(100).default(1),
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

  if (env.EMAIL_PROVIDER === 'smtp') {
    for (const name of ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_FROM'] as const) {
      if (env[name] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'is required when EMAIL_PROVIDER=smtp',
        });
      }
    }
    if ((env.SMTP_USER === undefined) !== (env.SMTP_PASSWORD === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_PASSWORD'],
        message: 'SMTP_USER and SMTP_PASSWORD must be set together',
      });
    }
  }
  if (env.EMAIL_PROVIDER === 'brevo') {
    for (const name of ['BREVO_API_KEY', 'EMAIL_SENDER_EMAIL'] as const) {
      if (env[name] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'is required when EMAIL_PROVIDER=brevo',
        });
      }
    }
  }
  if (env.BREVO_API_BASE_URL !== undefined && env.NODE_ENV === 'production') {
    ctx.addIssue({
      code: 'custom',
      path: ['BREVO_API_BASE_URL'],
      message: 'must not be set in production; the API key would be sent to that address',
    });
  }
  if (env.EMAIL_PROVIDER === 'dev-capture' && env.NODE_ENV === 'production') {
    ctx.addIssue({
      code: 'custom',
      path: ['EMAIL_PROVIDER'],
      message:
        'dev-capture keeps messages in memory and exposes them over HTTP; it is not allowed in production',
    });
  }

  if (env.NODE_ENV === 'production') {
    if (env.WEB_APP_URL === undefined) {
      ctx.addIssue({ code: 'custom', path: ['WEB_APP_URL'], message: 'is required in production' });
    } else if (!env.WEB_APP_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_APP_URL'],
        message: 'must use https in production',
      });
    }
    if (env.RATE_LIMIT_DISABLED === true) {
      ctx.addIssue({
        code: 'custom',
        path: ['RATE_LIMIT_DISABLED'],
        message: 'must not be set in production',
      });
    }
    // OWASP's minimum Argon2id profile. Lower values are accepted in development and tests only,
    // where hashing speed matters more than resistance to offline cracking.
    if (env.ARGON2_MEMORY_KIB < 19_456 || env.ARGON2_TIME_COST < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['ARGON2_MEMORY_KIB'],
        message: 'production requires at least 19456 KiB memory and time cost 2 for Argon2id',
      });
    }
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
