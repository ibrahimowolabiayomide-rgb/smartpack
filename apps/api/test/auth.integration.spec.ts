import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { auditLogs, sessions } from '../src/database/schema/index.js';
import {
  addMember,
  createOrg,
  startWorld,
  STRONG_PASSWORD,
  unique,
  type TestOrg,
  type World,
} from './harness.js';

describe('authentication', () => {
  let world: World;
  let org: TestOrg;

  beforeAll(async () => {
    world = await startWorld();
    org = await createOrg(world);
  });
  afterAll(async () => {
    await world.close();
  });

  it('rejects anonymous access to private endpoints', async () => {
    const response = await world.api.get('/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('signs in, returns the current user and sets a hardened cookie', async () => {
    const login = await world.api.post('/auth/login', {
      email: org.owner.email,
      password: STRONG_PASSWORD,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe(org.owner.email);
    expect(login.rawSetCookie).toMatch(/HttpOnly/i);
    expect(login.rawSetCookie).toMatch(/SameSite=Lax/i);
    expect(login.rawSetCookie).toMatch(/Path=\//);
    expect(JSON.stringify(login.body)).not.toMatch(/argon2|passwordHash|tokenHash/i);

    const me = await world.api.get('/auth/me', login.cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.organization.slug).toBe(org.slug);
    expect(me.body.data.permissions).toContain('organization.transfer_ownership');
  });

  it('stores only a hash of the session token', async () => {
    const cookie = await world.api.login(org.owner.email);
    const token = cookie.split('=')[1]!;
    const rows = await world.db.db.select().from(sessions);
    expect(rows.some((row) => JSON.stringify(row).includes(token))).toBe(false);
  });

  it('returns the same error for a wrong password and an unknown account', async () => {
    const wrong = await world.api.post('/auth/login', {
      email: org.owner.email,
      password: 'not-the-password-1',
    });
    const unknown = await world.api.post('/auth/login', {
      email: 'nobody@example.test',
      password: 'not-the-password-1',
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('rejects malformed login payloads with field errors', async () => {
    const response = await world.api.post('/auth/login', { email: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('issues a fresh session token on every sign-in and revokes the replaced cookie session', async () => {
    const first = await world.api.login(org.owner.email);
    const second = await world.api.request('POST', '/auth/login', {
      body: { email: org.owner.email, password: STRONG_PASSWORD },
      cookie: first,
    });
    expect(second.status).toBe(200);
    expect(second.cookie).not.toBe(first);
    expect((await world.api.get('/auth/me', first)).status).toBe(401);
    expect((await world.api.get('/auth/me', second.cookie)).status).toBe(200);
  });

  it('logs out and the old cookie stops working', async () => {
    const cookie = await world.api.login(org.owner.email);
    const out = await world.api.post('/auth/logout', {}, cookie);
    expect(out.status).toBe(200);
    expect(out.rawSetCookie).toMatch(/Max-Age=0|Expires=/i);
    expect((await world.api.get('/auth/me', cookie)).status).toBe(401);
  });

  it('logout-all ends every session of the user', async () => {
    const a = await world.api.login(org.owner.email);
    const b = await world.api.login(org.owner.email);
    expect((await world.api.post('/auth/logout-all', {}, a)).status).toBe(200);
    expect((await world.api.get('/auth/me', a)).status).toBe(401);
    expect((await world.api.get('/auth/me', b)).status).toBe(401);
  });

  it('lists sessions, revokes another one and keeps the current one', async () => {
    const a = await world.api.login(org.owner.email);
    const b = await world.api.login(org.owner.email);
    const list = await world.api.get('/auth/sessions', a);
    expect(list.status).toBe(200);
    const items = list.body.data.items as Array<{ id: string; current: boolean }>;
    const other = items.find((s) => !s.current)!;
    expect(items.filter((s) => s.current)).toHaveLength(1);
    expect((await world.api.del(`/auth/sessions/${other.id}`, a)).status).toBe(200);
    expect((await world.api.get('/auth/me', b)).status).toBe(401);
    expect((await world.api.get('/auth/me', a)).status).toBe(200);
  });

  it('revoke-others keeps only the current session', async () => {
    const a = await world.api.login(org.owner.email);
    const b = await world.api.login(org.owner.email);
    expect((await world.api.post('/auth/sessions/revoke-others', {}, a)).status).toBe(200);
    expect((await world.api.get('/auth/me', a)).status).toBe(200);
    expect((await world.api.get('/auth/me', b)).status).toBe(401);
  });

  it('refuses a cookie-authenticated state change from a foreign origin (CSRF)', async () => {
    const cookie = await world.api.login(org.owner.email);
    const evil = await world.api.request('POST', '/auth/logout', {
      cookie,
      origin: 'https://evil.example',
    });
    expect(evil.status).toBe(403);
    const none = await world.api.request('POST', '/auth/logout', { cookie, origin: null });
    expect(none.status).toBe(403);
    expect((await world.api.get('/auth/me', cookie)).status).toBe(200);
  });

  it('rejects an expired session and an idle-timed-out session', async () => {
    const expired = await world.api.login(org.owner.email);
    await world.db.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await world.api.get('/auth/me', expired)).status).toBe(401);

    const idle = await world.api.login(org.owner.email);
    await world.db.db.update(sessions).set({ lastActiveAt: new Date(Date.now() - 24 * 3_600_000) });
    expect((await world.api.get('/auth/me', idle)).status).toBe(401);
  });

  describe('password change', () => {
    it('requires the current password, revokes other sessions and issues a new one', async () => {
      const local = await createOrg(world);
      const a = await world.api.login(local.owner.email);
      const b = await world.api.login(local.owner.email);
      const bad = await world.api.post(
        '/auth/password/change',
        { currentPassword: 'wrong-password-123', newPassword: 'Another-Strong-Pass-77' },
        a,
      );
      expect(bad.status).toBe(400);
      expect(bad.body.error.details[0].path).toBe('currentPassword');
      const ok = await world.api.post(
        '/auth/password/change',
        { currentPassword: STRONG_PASSWORD, newPassword: 'Another-Strong-Pass-77' },
        b,
      );
      expect(ok.status).toBe(200);
      expect((await world.api.get('/auth/me', a)).status).toBe(401);
      expect((await world.api.get('/auth/me', b)).status).toBe(401);
      expect((await world.api.get('/auth/me', ok.cookie)).status).toBe(200);
      expect(
        (
          await world.api.post('/auth/login', {
            email: local.owner.email,
            password: STRONG_PASSWORD,
          })
        ).status,
      ).toBe(401);
      await world.api.login(local.owner.email, 'Another-Strong-Pass-77');
    });

    it('rejects weak and common passwords on the server', async () => {
      const local = await createOrg(world);
      const cookie = await world.api.login(local.owner.email);
      for (const weak of ['short', 'passwordpassword', 'aaaaaaaaaaaaaaaa', local.owner.email]) {
        const response = await world.api.post(
          '/auth/password/change',
          { currentPassword: STRONG_PASSWORD, newPassword: weak },
          cookie,
        );
        expect({ weak, status: response.status }).toEqual({ weak, status: 400 });
      }
    });
  });

  describe('password reset', () => {
    it('answers identically for known and unknown addresses and sends mail only to known ones', async () => {
      const local = await createOrg(world);
      const known = await world.api.post('/auth/password/forgot', { email: local.owner.email });
      const unknown = await world.api.post('/auth/password/forgot', {
        email: `x-${unique('u')}@example.test`,
      });
      expect(known.status).toBe(202);
      expect(unknown.status).toBe(known.status);
      expect(unknown.body).toEqual(known.body);
      const mail = await world.api.mailbox();
      expect(mail.some((m) => m.to === local.owner.email && /reset/i.test(m.subject))).toBe(true);
    });

    it('resets once, revokes all sessions and rejects reuse', async () => {
      const local = await createOrg(world);
      const session = await world.api.login(local.owner.email);
      await world.api.post('/auth/password/forgot', { email: local.owner.email });
      const token = await world.api.latestToken(local.owner.email);
      const reset = await world.api.post('/auth/password/reset', {
        token,
        newPassword: 'Brand-New-Secret-91',
      });
      expect(reset.status).toBe(200);
      expect((await world.api.get('/auth/me', session)).status).toBe(401);
      const again = await world.api.post('/auth/password/reset', {
        token,
        newPassword: 'Yet-Another-Secret-12',
      });
      expect(again.status).toBe(400);
      expect(again.body.error.code).toBe('INVALID_TOKEN');
      await world.api.login(local.owner.email, 'Brand-New-Secret-91');
    });

    it('rejects a malformed and an unknown token the same way', async () => {
      const bad = await world.api.post('/auth/password/reset', {
        token: 'x',
        newPassword: 'Brand-New-Secret-91',
      });
      expect(bad.status).toBe(400);
      const unknown = await world.api.post('/auth/password/reset', {
        token: 'A'.repeat(43),
        newPassword: 'Brand-New-Secret-91',
      });
      expect(unknown.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('email verification', () => {
    it('verifies an address once with a mailed token', async () => {
      const local = await createOrg(world);
      const owner = await world.api.login(local.owner.email);
      const member = await addMember(world, owner, 'worker');
      await world.db.db.execute(
        (await import('drizzle-orm'))
          .sql`update users set email_verified_at = null where id = ${member.userId}`,
      );
      const cookie = await world.api.login(member.email);
      expect((await world.api.post('/auth/email/resend-verification', {}, cookie)).status).toBe(
        200,
      );
      const token = await world.api.latestToken(member.email);
      expect((await world.api.post('/auth/email/verify', { token })).status).toBe(200);
      expect((await world.api.get('/auth/me', cookie)).body.data.user.emailVerified).toBe(true);
      expect((await world.api.post('/auth/email/verify', { token })).status).toBe(400);
    });
  });

  it('records sign-in events in the audit log without secrets', async () => {
    const local = await createOrg(world);
    await world.api.login(local.owner.email);
    await world.api.post('/auth/login', {
      email: local.owner.email,
      password: 'wrong-password-123',
    });
    const rows = await world.db.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, local.organizationId));
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['auth.login.succeeded', 'auth.login.failed']));
    expect(JSON.stringify(rows)).not.toMatch(/wrong-password-123|Sturdy-Lantern/);
  });
});
