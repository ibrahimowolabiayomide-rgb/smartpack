import { describe, expect, it } from '@jest/globals';
import { ConfigError, loadConfig, loadDatabaseConfig } from './app-config.js';
import { parseOriginList } from './env.schema.js';

const DB = 'postgresql://app_user:s3cretPassw0rd@db.internal:5432/smartpack';

function load(env: Record<string, string>) {
  return loadConfig({ DATABASE_URL: DB, ...env });
}

function failureMessage(env: Record<string, string>): string {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as Error).message;
  }
  throw new Error('expected loadConfig to throw');
}

describe('loadConfig defaults', () => {
  it('applies safe development defaults', () => {
    const config = load({});
    expect(config.env).toBe('development');
    expect(config.isProduction).toBe(false);
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(4000);
    expect(config.logLevel).toBe('debug');
    expect(config.docs.enabled).toBe(true);
    expect(config.cors.allowedOrigins).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
    expect(config.database.ssl).toBe('disable');
    expect(config.database.poolMax).toBe(10);
  });

  it('is silent in test and quieter in production', () => {
    expect(load({ NODE_ENV: 'test' }).logLevel).toBe('silent');
    expect(
      load({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://app.example.com' }).logLevel,
    ).toBe('info');
  });

  it('treats empty values as unset, as copied from a template', () => {
    const config = load({ LOG_LEVEL: '', PORT: '', HOST: '' });
    expect(config.logLevel).toBe('debug');
    expect(config.port).toBe(4000);
  });

  it('returns frozen configuration', () => {
    expect(Object.isFrozen(load({}))).toBe(true);
  });
});

describe('loadConfig production rules', () => {
  const prod = { NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://app.example.com' };

  it('binds all interfaces, requires TLS to the database and hides the docs by default', () => {
    const config = load(prod);
    expect(config.isProduction).toBe(true);
    expect(config.host).toBe('0.0.0.0');
    expect(config.database.ssl).toBe('require');
    expect(config.docs.enabled).toBe(false);
  });

  it('lets the docs be enabled explicitly', () => {
    expect(load({ ...prod, ENABLE_API_DOCS: 'true' }).docs.enabled).toBe(true);
  });

  it('refuses to start without allowed origins', () => {
    expect(failureMessage({ DATABASE_URL: DB, NODE_ENV: 'production' })).toContain(
      'CORS_ALLOWED_ORIGINS',
    );
  });

  it('refuses plain-http origins', () => {
    const message = failureMessage({
      DATABASE_URL: DB,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'http://app.example.com',
    });
    expect(message).toContain('must use https in production');
  });
});

describe('loadConfig validation', () => {
  it('requires DATABASE_URL', () => {
    expect(failureMessage({})).toContain('DATABASE_URL: is required');
  });

  it('rejects a non-postgres URL', () => {
    expect(failureMessage({ DATABASE_URL: 'mysql://u:p@h/db' })).toContain(
      'postgres:// or postgresql://',
    );
  });

  it('rejects sslmode in the URL so TLS has exactly one source of truth', () => {
    expect(failureMessage({ DATABASE_URL: `${DB}?sslmode=require` })).toContain(
      'set DATABASE_SSL instead',
    );
  });

  it('rejects an out-of-range port and an unknown NODE_ENV', () => {
    const message = failureMessage({ DATABASE_URL: DB, PORT: '70000', NODE_ENV: 'staging' });
    expect(message).toContain('PORT');
    expect(message).toContain('NODE_ENV');
  });

  it('reports every problem at once instead of one per run', () => {
    const message = failureMessage({ PORT: 'abc', LOG_LEVEL: 'loud' });
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PORT');
    expect(message).toContain('LOG_LEVEL');
  });

  it('never echoes secret values in an error message', () => {
    const message = failureMessage({
      DATABASE_URL: 'mysql://app_user:s3cretPassw0rd@db.internal/x',
    });
    expect(message).not.toContain('s3cretPassw0rd');
    expect(message).not.toContain('app_user');
  });
});

describe('loadDatabaseConfig', () => {
  it('needs only database variables, so the migration job does not require API settings', () => {
    const config = loadDatabaseConfig({ NODE_ENV: 'production', DATABASE_URL: DB });
    expect(config.url).toBe(DB);
    expect(config.ssl).toBe('require');
  });

  it('still validates the database URL', () => {
    expect(() => loadDatabaseConfig({})).toThrow(ConfigError);
  });
});

describe('parseOriginList', () => {
  it('accepts bare origins with ports', () => {
    expect(parseOriginList('https://a.example.com, http://localhost:3000').origins).toEqual([
      'https://a.example.com',
      'http://localhost:3000',
    ]);
  });

  it.each([
    ['*', 'is not a valid origin'],
    ['https://a.example.com/', 'bare origin'],
    ['https://a.example.com/app', 'bare origin'],
    ['ftp://a.example.com', 'http or https'],
    ['null', 'is not a valid origin'],
  ])('rejects %s', (input, expected) => {
    const { origins, problems } = parseOriginList(input);
    expect(origins).toEqual([]);
    expect(problems.join()).toContain(expected);
  });
});
