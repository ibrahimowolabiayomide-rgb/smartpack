import type { z } from 'zod';
import { APP_VERSION } from './app-info.js';
import {
  databaseEnvSchema,
  envSchema,
  parseOriginList,
  type DATABASE_SSL_MODES,
  type EMAIL_PROVIDERS,
  type LOG_LEVELS,
  type NODE_ENVS,
} from './env.schema.js';

export type DatabaseSslMode = (typeof DATABASE_SSL_MODES)[number];

export interface DatabaseConfig {
  url: string;
  ssl: DatabaseSslMode;
  poolMax: number;
  connectionTimeoutMs: number;
  queryTimeoutMs: number;
}

export type EmailProviderName = (typeof EMAIL_PROVIDERS)[number];

export interface AuthConfig {
  sessionIdleMs: number;
  sessionAbsoluteMs: number;
  /** `__Host-` prefix in production: the browser then refuses the cookie unless it is Secure,
   *  has Path=/ and carries no Domain attribute. */
  cookieName: string;
  cookieSecure: boolean;
  argon2: { memoryKib: number; timeCost: number; parallelism: number };
  invitationTtlMs: number;
  passwordResetTtlMs: number;
  emailVerificationTtlMs: number;
}

export interface EmailConfig {
  provider: EmailProviderName;
  /** Display form `Name <address>` used by the SMTP and dev-capture providers. */
  from: string;
  /** Structured sender used by the Brevo provider. */
  sender: { name: string; email: string | undefined };
  /** `baseUrl` is an origin; the provider appends the versioned path. */
  brevo: { apiKey: string; baseUrl: string } | null;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string | undefined;
    password: string | undefined;
  } | null;
}

export interface AppConfig {
  env: (typeof NODE_ENVS)[number];
  isProduction: boolean;
  host: string;
  port: number;
  logLevel: (typeof LOG_LEVELS)[number];
  version: string;
  cors: { allowedOrigins: string[] };
  docs: { enabled: boolean };
  database: DatabaseConfig;
  /** Origin of the web application, used for links in emails. */
  webAppUrl: string;
  trustProxyHops: number;
  auth: AuthConfig;
  email: EmailConfig;
  rateLimit: { enabled: boolean; scale: number };
}

/** Thrown when the environment is invalid. The message lists variable names, never values. */
export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

const DEFAULT_SENDER_NAME = 'SmartPack';
const DEFAULT_BREVO_ORIGIN = 'https://api.brevo.com';

const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/** Empty strings (e.g. `LOG_LEVEL=` copied from a template) are treated as unset. */
function withoutEmptyValues(source: NodeJS.ProcessEnv): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value.trim() !== '') cleaned[key] = value.trim();
  }
  return cleaned;
}

function describeIssues(issues: z.core.$ZodIssue[]): string[] {
  return issues.map((issue) => {
    const name = issue.path.length > 0 ? issue.path.join('.') : 'environment';
    return `${name}: ${issue.message}`;
  });
}

function defaultSslMode(env: AppConfig['env']): DatabaseSslMode {
  return env === 'production' ? 'require' : 'disable';
}

/** Validates the environment and returns immutable, typed configuration. */
export function loadConfig(source: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(withoutEmptyValues(source));
  if (!parsed.success) throw new ConfigError(describeIssues(parsed.error.issues));
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  const config: AppConfig = {
    env: env.NODE_ENV,
    isProduction,
    host: env.HOST ?? (isProduction ? '0.0.0.0' : '127.0.0.1'),
    port: env.PORT,
    logLevel:
      env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug'),
    version: APP_VERSION,
    cors: {
      allowedOrigins: env.CORS_ALLOWED_ORIGINS
        ? parseOriginList(env.CORS_ALLOWED_ORIGINS).origins
        : DEV_ORIGINS,
    },
    docs: { enabled: env.ENABLE_API_DOCS ?? !isProduction },
    database: {
      url: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ?? defaultSslMode(env.NODE_ENV),
      poolMax: env.DATABASE_POOL_MAX,
      connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS,
      queryTimeoutMs: env.DATABASE_QUERY_TIMEOUT_MS,
    },
    webAppUrl: (env.WEB_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
    trustProxyHops: env.TRUST_PROXY_HOPS,
    auth: {
      sessionIdleMs: env.SESSION_IDLE_TIMEOUT_MINUTES * 60_000,
      sessionAbsoluteMs: env.SESSION_ABSOLUTE_TIMEOUT_HOURS * 3_600_000,
      cookieName: isProduction ? '__Host-sp_session' : 'sp_session',
      cookieSecure: isProduction,
      argon2: {
        memoryKib: env.ARGON2_MEMORY_KIB,
        timeCost: env.ARGON2_TIME_COST,
        parallelism: env.ARGON2_PARALLELISM,
      },
      invitationTtlMs: env.INVITATION_TTL_HOURS * 3_600_000,
      passwordResetTtlMs: env.PASSWORD_RESET_TTL_MINUTES * 60_000,
      emailVerificationTtlMs: env.EMAIL_VERIFICATION_TTL_HOURS * 3_600_000,
    },
    email: {
      // Production never sends mail unless a provider was chosen on purpose.
      provider: env.EMAIL_PROVIDER ?? (isProduction ? 'none' : 'dev-capture'),
      from:
        env.EMAIL_FROM ??
        (env.EMAIL_SENDER_EMAIL !== undefined
          ? `${env.EMAIL_SENDER_NAME ?? DEFAULT_SENDER_NAME} <${env.EMAIL_SENDER_EMAIL}>`
          : 'SmartPack <no-reply@smartpack.invalid>'),
      sender: { name: env.EMAIL_SENDER_NAME ?? DEFAULT_SENDER_NAME, email: env.EMAIL_SENDER_EMAIL },
      brevo:
        env.EMAIL_PROVIDER === 'brevo' && env.BREVO_API_KEY !== undefined
          ? {
              apiKey: env.BREVO_API_KEY,
              baseUrl: (env.BREVO_API_BASE_URL ?? DEFAULT_BREVO_ORIGIN).replace(/\/+$/, ''),
            }
          : null,
      smtp:
        env.EMAIL_PROVIDER === 'smtp' && env.SMTP_HOST !== undefined && env.SMTP_PORT !== undefined
          ? {
              host: env.SMTP_HOST,
              port: env.SMTP_PORT,
              secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
              user: env.SMTP_USER,
              password: env.SMTP_PASSWORD,
            }
          : null,
    },
    rateLimit: { enabled: env.RATE_LIMIT_DISABLED !== true, scale: env.RATE_LIMIT_SCALE },
  };
  return Object.freeze(config);
}

/** Database-only configuration for tooling that must not require API-only variables. */
export function loadDatabaseConfig(source: NodeJS.ProcessEnv): DatabaseConfig {
  const parsed = databaseEnvSchema.safeParse(withoutEmptyValues(source));
  if (!parsed.success) throw new ConfigError(describeIssues(parsed.error.issues));
  const env = parsed.data;
  return {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ?? defaultSslMode(env.NODE_ENV),
    poolMax: env.DATABASE_POOL_MAX,
    connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS,
    queryTimeoutMs: env.DATABASE_QUERY_TIMEOUT_MS,
  };
}
