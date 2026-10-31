import type { z } from 'zod';
import { APP_VERSION } from './app-info.js';
import {
  databaseEnvSchema,
  envSchema,
  parseOriginList,
  type DATABASE_SSL_MODES,
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
}

/** Thrown when the environment is invalid. The message lists variable names, never values. */
export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

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
