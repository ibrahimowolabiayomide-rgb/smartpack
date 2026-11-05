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
      load({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://app.example.com',
        WEB_APP_URL: 'https://app.example.com',
      }).logLevel,
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
  const prod = {
    NODE_ENV: 'production',
    CORS_ALLOWED_ORIGINS: 'https://app.example.com',
    WEB_APP_URL: 'https://app.example.com',
  };

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

describe('loadConfig authentication and email settings', () => {
  const prod = {
    NODE_ENV: 'production',
    CORS_ALLOWED_ORIGINS: 'https://app.example.com',
    WEB_APP_URL: 'https://app.example.com',
  };

  it('uses documented development defaults', () => {
    const config = load({});
    expect(config.webAppUrl).toBe('http://localhost:3000');
    expect(config.auth.sessionIdleMs).toBe(8 * 3_600_000);
    expect(config.auth.sessionAbsoluteMs).toBe(7 * 24 * 3_600_000);
    expect(config.auth.cookieName).toBe('sp_session');
    expect(config.auth.cookieSecure).toBe(false);
    expect(config.auth.argon2).toEqual({ memoryKib: 19_456, timeCost: 2, parallelism: 1 });
    expect(config.email.provider).toBe('dev-capture');
    expect(config.rateLimit).toEqual({ enabled: true, scale: 1 });
  });

  it('uses a __Host- secure cookie and no email provider in production by default', () => {
    const config = load(prod);
    expect(config.auth.cookieName).toBe('__Host-sp_session');
    expect(config.auth.cookieSecure).toBe(true);
    expect(config.email.provider).toBe('none');
  });

  it('requires WEB_APP_URL over https in production', () => {
    const { WEB_APP_URL: _omit, ...withoutUrl } = prod;
    expect(failureMessage({ DATABASE_URL: DB, ...withoutUrl })).toContain(
      'WEB_APP_URL: is required in production',
    );
    expect(
      failureMessage({ DATABASE_URL: DB, ...prod, WEB_APP_URL: 'http://app.example.com' }),
    ).toContain('WEB_APP_URL: must use https in production');
  });

  it('rejects a web app URL that carries a path', () => {
    expect(
      failureMessage({ DATABASE_URL: DB, WEB_APP_URL: 'http://localhost:3000/app' }),
    ).toContain('bare origin');
  });

  it('forbids the development mail capture and disabled rate limits in production', () => {
    expect(failureMessage({ DATABASE_URL: DB, ...prod, EMAIL_PROVIDER: 'dev-capture' })).toContain(
      'not allowed in production',
    );
    expect(failureMessage({ DATABASE_URL: DB, ...prod, RATE_LIMIT_DISABLED: 'true' })).toContain(
      'RATE_LIMIT_DISABLED: must not be set in production',
    );
  });

  it('requires production password hashing to meet the minimum profile', () => {
    expect(failureMessage({ DATABASE_URL: DB, ...prod, ARGON2_MEMORY_KIB: '4096' })).toContain(
      'at least 19456 KiB',
    );
    expect(
      load({ ...prod, ARGON2_MEMORY_KIB: '47104', ARGON2_TIME_COST: '3' }).auth.argon2.memoryKib,
    ).toBe(47_104);
    // Cheaper hashing is allowed outside production so tests stay fast.
    expect(load({ ARGON2_MEMORY_KIB: '4096', ARGON2_TIME_COST: '1' }).auth.argon2.timeCost).toBe(1);
  });

  it('needs a complete SMTP configuration when SMTP is chosen', () => {
    const message = failureMessage({ DATABASE_URL: DB, EMAIL_PROVIDER: 'smtp' });
    expect(message).toContain('SMTP_HOST: is required when EMAIL_PROVIDER=smtp');
    expect(message).toContain('EMAIL_FROM: is required when EMAIL_PROVIDER=smtp');
    expect(
      failureMessage({
        DATABASE_URL: DB,
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'h',
        SMTP_PORT: '587',
        EMAIL_FROM: 'a@b.co',
        SMTP_USER: 'u',
      }),
    ).toContain('must be set together');
  });

  it('never puts the SMTP password in an error message', () => {
    const message = failureMessage({
      DATABASE_URL: DB,
      EMAIL_PROVIDER: 'smtp',
      SMTP_PASSWORD: 'hunter2-secret',
    });
    expect(message).not.toContain('hunter2-secret');
  });

  describe('Brevo', () => {
    const brevo = {
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'xkeysib-test-key-0123456789abcdef',
      EMAIL_SENDER_EMAIL: 'sender@example.test',
    };

    it('needs the API key and the sender address', () => {
      const message = failureMessage({ DATABASE_URL: DB, EMAIL_PROVIDER: 'brevo' });
      expect(message).toContain('BREVO_API_KEY: is required when EMAIL_PROVIDER=brevo');
      expect(message).toContain('EMAIL_SENDER_EMAIL: is required when EMAIL_PROVIDER=brevo');
    });

    it('builds the sender from the environment and defaults the name to SmartPack', () => {
      const config = load(brevo);
      expect(config.email.provider).toBe('brevo');
      expect(config.email.sender).toEqual({ name: 'SmartPack', email: 'sender@example.test' });
      expect(config.email.brevo).toEqual({
        apiKey: brevo.BREVO_API_KEY,
        baseUrl: 'https://api.brevo.com',
      });
      const renamed = load({ ...brevo, EMAIL_SENDER_NAME: 'Acme Asset Desk' });
      expect(renamed.email.sender.name).toBe('Acme Asset Desk');
      expect(renamed.email.from).toBe('Acme Asset Desk <sender@example.test>');
    });

    it('rejects a malformed sender address or a name that could break headers', () => {
      expect(failureMessage({ DATABASE_URL: DB, ...brevo, EMAIL_SENDER_EMAIL: 'nope' })).toContain(
        'EMAIL_SENDER_EMAIL',
      );
      expect(
        failureMessage({ DATABASE_URL: DB, ...brevo, EMAIL_SENDER_NAME: 'Evil <a@b.co>' }),
      ).toContain('EMAIL_SENDER_NAME');
    });

    it('never puts the API key in an error message', () => {
      const message = failureMessage({
        DATABASE_URL: DB,
        EMAIL_PROVIDER: 'brevo',
        BREVO_API_KEY: brevo.BREVO_API_KEY,
      });
      expect(message).not.toContain(brevo.BREVO_API_KEY);
    });

    it('is allowed in production, but the API origin override is not', () => {
      const prod = {
        NODE_ENV: 'production',
        WEB_APP_URL: 'https://app.example.com',
        CORS_ALLOWED_ORIGINS: 'https://app.example.com',
        ...brevo,
      };
      expect(load(prod).email.provider).toBe('brevo');
      expect(
        failureMessage({ DATABASE_URL: DB, ...prod, BREVO_API_BASE_URL: 'https://evil.example' }),
      ).toContain('BREVO_API_BASE_URL: must not be set in production');
    });

    it('leaves the SMTP and none providers without Brevo settings', () => {
      expect(load({}).email.brevo).toBeNull();
    });
  });

  it('infers SMTPS for port 465 unless told otherwise', () => {
    const base = {
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'mail.example.com',
      EMAIL_FROM: 'SmartPack <a@b.co>',
    };
    expect(load({ ...base, SMTP_PORT: '465' }).email.smtp?.secure).toBe(true);
    expect(load({ ...base, SMTP_PORT: '587' }).email.smtp?.secure).toBe(false);
    expect(load({ ...base, SMTP_PORT: '587', SMTP_SECURE: 'true' }).email.smtp?.secure).toBe(true);
  });
});
