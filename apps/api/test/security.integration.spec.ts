import { afterAll, describe, expect, it } from '@jest/globals';
import { DiscoveryService, MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { SMTPServer } from 'smtp-server';
import { eq } from 'drizzle-orm';
import { emailDeliveries } from '../src/database/schema/index.js';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../src/auth/decorators.js';
import { createOrg, startWorld, STRONG_PASSWORD, unique, type World } from './harness.js';

/** Every route that is reachable without a session. Adding one must be a deliberate decision. */
const EXPECTED_PUBLIC_ROUTES = [
  'DELETE dev/mailbox',
  'GET dev/mailbox',
  'GET health',
  'POST auth/email/verify',
  'POST auth/login',
  'POST auth/password/forgot',
  'POST auth/password/reset',
  'POST invitations/accept',
  'POST invitations/preview',
].sort();

describe('route protection', () => {
  let world: World;
  afterAll(async () => {
    await world.close();
  });

  it('protects every route by default; the public set is exactly the reviewed list', async () => {
    world = await startWorld();
    const discovery = new DiscoveryService(world.app.get(ModulesContainer, { strict: false }));
    const reflector = world.app.get(Reflector);
    const scanner = new MetadataScanner();
    const publicRoutes: string[] = [];
    const unprotectedInternal: string[] = [];

    for (const wrapper of discovery.getControllers()) {
      const instance = wrapper.instance as object | undefined;
      const type = wrapper.metatype;
      if (!instance || !type) continue;
      const base = (Reflect.getMetadata(PATH_METADATA, type) as string | undefined) ?? '';
      for (const name of scanner.getAllMethodNames(Object.getPrototypeOf(instance) as object)) {
        const handler = (instance as Record<string, unknown>)[name] as (
          ...args: unknown[]
        ) => unknown;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        if (method === undefined) continue; // not a route
        const path = (Reflect.getMetadata(PATH_METADATA, handler) as string | undefined) ?? '';
        const verb = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'][method] ?? String(method);
        const joined = [base, path]
          .join('/')
          .replace(/\/+/g, '/')
          .replace(/^\/|\/$/g, '');
        const route = `${verb} ${joined}`;
        const isPublic =
          reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [handler, type]) === true;
        if (isPublic) publicRoutes.push(route);
        else if (
          reflector.get(PERMISSIONS_KEY, handler) === undefined &&
          !route.includes('auth/') &&
          !route.includes('organizations/current')
        ) {
          unprotectedInternal.push(route);
        }
      }
    }
    expect(publicRoutes.sort()).toEqual(EXPECTED_PUBLIC_ROUTES);
    // Routes that are authenticated-only (no specific permission) are limited to the user's own data.
    expect(unprotectedInternal).toEqual([]);
  });

  it('answers 401 for every non-public route without a session', async () => {
    const probes: Array<[string, string]> = [
      ['GET', '/auth/me'],
      ['GET', '/auth/sessions'],
      ['GET', '/organizations/current'],
      ['GET', '/organizations/current/members'],
      ['GET', '/organizations/current/invitations'],
      ['GET', '/organizations/current/roles'],
      ['GET', '/organizations/current/permissions'],
      ['GET', '/organizations/current/audit-logs'],
      ['POST', '/organizations/current/invitations'],
      ['POST', '/auth/logout'],
      ['POST', '/auth/logout-all'],
      ['POST', '/auth/password/change'],
    ];
    for (const [method, url] of probes) {
      const response = await world.api.request(method as 'GET' | 'POST', url, { body: {} });
      expect({ url, status: response.status }).toEqual({ url, status: 401 });
    }
  });

  it('rejects a forged or malformed session cookie', async () => {
    for (const cookie of ['sp_session=garbage', `sp_session=${'A'.repeat(43)}`, 'sp_session=']) {
      expect((await world.api.get('/auth/me', cookie)).status).toBe(401);
    }
  });

  it('does not expose the dev mailbox unless dev-capture is configured', async () => {
    const prodLike = await startWorld({ EMAIL_PROVIDER: 'none' });
    try {
      expect((await prodLike.api.get('/dev/mailbox')).status).toBe(404);
    } finally {
      await prodLike.close();
    }
  });
});

describe('rate limiting', () => {
  it('blocks repeated failed sign-ins for one account and keeps other accounts unaffected', async () => {
    const limited = await startWorld({ RATE_LIMIT_DISABLED: 'false' });
    try {
      const target = await createOrg(limited);
      const bystander = await createOrg(limited);
      const codes: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        codes.push(
          (
            await limited.api.post('/auth/login', {
              email: target.owner.email,
              password: `wrong-password-${i}x`,
            })
          ).status,
        );
      }
      expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(codes[5]).toBe(429);
      // Even the right password is refused while locked out, and the response says when to retry.
      const locked = await limited.api.post('/auth/login', {
        email: target.owner.email,
        password: STRONG_PASSWORD,
      });
      expect(locked.status).toBe(429);
      expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
      expect(locked.body.error.code).toBe('RATE_LIMITED');
      // A different account is not affected by someone else's lock-out.
      expect(
        (
          await limited.api.post('/auth/login', {
            email: bystander.owner.email,
            password: STRONG_PASSWORD,
          })
        ).status,
      ).toBe(200);
    } finally {
      await limited.close();
    }
  });

  it('limits password-reset requests per address without revealing whether it exists', async () => {
    const limited = await startWorld({ RATE_LIMIT_DISABLED: 'false' });
    try {
      const target = await createOrg(limited);
      const statuses: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        statuses.push(
          (await limited.api.post('/auth/password/forgot', { email: target.owner.email })).status,
        );
      }
      const unknown: number[] = [];
      const ghost = `${unique('no')}@example.test`;
      for (let i = 0; i < 5; i += 1) {
        unknown.push((await limited.api.post('/auth/password/forgot', { email: ghost })).status);
      }
      expect(statuses).toEqual(unknown);
      const mails = (await limited.api.mailbox()).filter((m) => m.to === target.owner.email);
      expect(mails.length).toBeLessThanOrEqual(3);
    } finally {
      await limited.close();
    }
  });

  it('limits token guessing on the invitation endpoints per address', async () => {
    const limited = await startWorld({ RATE_LIMIT_DISABLED: 'false' });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 25; i += 1) {
        codes.push(
          (await limited.api.post('/invitations/preview', { token: 'B'.repeat(43) })).status,
        );
      }
      expect(codes).toContain(429);
      expect(codes.filter((c) => c === 400).length).toBeLessThanOrEqual(20);
    } finally {
      await limited.close();
    }
  });
});

describe('production configuration', () => {
  it('uses a __Host- Secure HttpOnly cookie and reports an unconfigured mail provider honestly', async () => {
    const production = await startWorld({
      NODE_ENV: 'production',
      WEB_APP_URL: 'https://app.example.test',
      CORS_ALLOWED_ORIGINS: 'https://app.example.test',
      EMAIL_PROVIDER: 'none',
      RATE_LIMIT_DISABLED: 'false',
      ARGON2_MEMORY_KIB: '19456',
      ARGON2_TIME_COST: '2',
    });
    try {
      const org = await createOrg(production);
      const login = await production.api.post('/auth/login', {
        email: org.owner.email,
        password: STRONG_PASSWORD,
      });
      expect(login.status).toBe(200);
      expect(login.rawSetCookie).toMatch(/^__Host-sp_session=/);
      expect(login.rawSetCookie).toMatch(/; Secure/i);
      expect(login.rawSetCookie).toMatch(/HttpOnly/i);
      expect(login.rawSetCookie).toMatch(/SameSite=Lax/i);
      expect(login.rawSetCookie).not.toMatch(/Domain=/i);

      const invite = await production.api.request('POST', '/organizations/current/invitations', {
        body: { email: `${unique('np')}@example.test`, role: 'worker' },
        cookie: login.cookie,
        origin: 'https://app.example.test',
      });
      expect(invite.status).toBe(201);
      expect(invite.body.data.emailDelivery).toBe('not_configured');
      const rows = await production.db.db
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.organizationId, org.organizationId));
      // Nothing was handed to a provider, so nothing is logged as delivered.
      expect(rows).toHaveLength(0);
    } finally {
      await production.close();
    }
  });

  it('does not leak error internals in production responses', async () => {
    const production = await startWorld({
      NODE_ENV: 'production',
      WEB_APP_URL: 'https://app.example.test',
      CORS_ALLOWED_ORIGINS: 'https://app.example.test',
      EMAIL_PROVIDER: 'none',
      RATE_LIMIT_DISABLED: 'false',
      ARGON2_MEMORY_KIB: '19456',
      ARGON2_TIME_COST: '2',
    });
    try {
      const response = await production.api.get('/auth/me');
      expect(JSON.stringify(response.body)).not.toMatch(/stack|at .*\.ts|node_modules/);
    } finally {
      await production.close();
    }
  });
});

describe('SMTP provider', () => {
  it('delivers a real invitation through a local SMTP server', async () => {
    const received: string[] = [];
    const server = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      onData(stream, _session, callback) {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          received.push(Buffer.concat(chunks).toString('utf8'));
          callback();
        });
      },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const smtpWorld = await startWorld({
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(port),
      SMTP_SECURE: 'false',
      EMAIL_FROM: 'SmartPack <no-reply@example.test>',
    });
    try {
      const org = await createOrg(smtpWorld);
      const cookie = await smtpWorld.api.login(org.owner.email);
      const email = `${unique('smtp')}@example.test`;
      const created = await smtpWorld.api.post(
        '/organizations/current/invitations',
        { email, role: 'worker' },
        cookie,
      );
      expect(created.status).toBe(201);
      expect(created.body.data.emailDelivery).toBe('sent');
      expect(received).toHaveLength(1);
      expect(received[0]).toContain(`To: ${email}`);
      expect(received[0]).toMatch(/accept-invitation#token=/);
      // The dev mailbox must not exist for this provider.
      expect((await smtpWorld.api.get('/dev/mailbox')).status).toBe(404);
    } finally {
      await smtpWorld.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports a failed delivery instead of pretending, and the invitation still exists', async () => {
    const downWorld = await startWorld({
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1',
      SMTP_SECURE: 'false',
      EMAIL_FROM: 'SmartPack <no-reply@example.test>',
    });
    try {
      const org = await createOrg(downWorld);
      const cookie = await downWorld.api.login(org.owner.email);
      const created = await downWorld.api.post(
        '/organizations/current/invitations',
        { email: `${unique('f')}@example.test`, role: 'worker' },
        cookie,
      );
      expect(created.status).toBe(201);
      expect(created.body.data.emailDelivery).toBe('failed');
      expect(created.body.data.invitation.status).toBe('pending');
    } finally {
      await downWorld.close();
    }
  });
});
