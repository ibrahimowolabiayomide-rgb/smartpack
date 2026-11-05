import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { eq, sql } from 'drizzle-orm';
import { emailDeliveries } from '../src/database/schema/index.js';
import { createOrg, startWorld, STRONG_PASSWORD, unique, type World } from './harness.js';

const API_KEY = 'xkeysib-integration-test-key-0123456789abcdef';

interface BrevoRequest {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: {
    sender: { name: string; email: string };
    to: Array<{ email: string }>;
    subject: string;
    htmlContent: string;
    textContent: string;
  };
}

/**
 * A local HTTP server that speaks Brevo's `POST /v3/smtp/email` contract. It stands in for the
 * third-party service only; everything on the SmartPack side (configuration, provider, templates,
 * flows, database) is the real code. Delivery to the real Brevo needs a real API key.
 */
class BrevoStandIn {
  readonly requests: BrevoRequest[] = [];
  status = 201;
  private server: Server | undefined;
  origin = '';

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const valid = req.headers['api-key'] === API_KEY;
        if (this.status === 201 && valid) {
          this.requests.push({
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as BrevoRequest['body'],
          });
          res.writeHead(201, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ messageId: `<${this.requests.length}@brevo.test>` }));
        } else {
          res.writeHead(valid ? this.status : 401, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }));
        }
      });
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    this.origin = `http://127.0.0.1:${(this.server?.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  to(email: string): BrevoRequest[] {
    return this.requests.filter((r) => r.body.to[0]?.email === email);
  }
}

/** The response shapes this spec reads; typed here so the lint exemption list stays unchanged. */
interface InvitationResponse {
  data: { emailDelivery: string; invitation: { status: string } };
}
interface DeliveryResponse {
  data: { emailDelivery: string };
}
interface MeResponse {
  data: { user: { emailVerified: boolean } };
}

function tokenIn(text: string): string {
  const match = text.match(/#token=([A-Za-z0-9_-]{43})/);
  if (!match?.[1]) throw new Error('No token link in the message');
  return match[1];
}

async function eventually<T>(read: () => T | undefined): Promise<T> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the email');
}

describe('Brevo provider (real application, local Brevo stand-in)', () => {
  const brevo = new BrevoStandIn();
  let world: World;

  beforeAll(async () => {
    await brevo.start();
    world = await startWorld({
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: API_KEY,
      BREVO_API_BASE_URL: brevo.origin,
      EMAIL_SENDER_NAME: 'SmartPack Test',
      EMAIL_SENDER_EMAIL: 'sender@example.test',
    });
  });

  afterAll(async () => {
    await world.close();
    await brevo.stop();
  });

  it('sends invitation, verification and password-reset emails through the Brevo API', async () => {
    const org = await createOrg(world);
    const ownerCookie = await world.api.login(org.owner.email);
    const invitee = `${unique('brevo')}@example.test`;

    // 1. Company invitation.
    const invited = await world.api.post<InvitationResponse>(
      '/organizations/current/invitations',
      { email: invitee, role: 'worker' },
      ownerCookie,
    );
    expect(invited.status).toBe(201);
    expect(invited.body.data.emailDelivery).toBe('sent');
    const invitation = brevo.to(invitee)[0];
    expect(invitation).toBeDefined();
    expect(invitation?.method).toBe('POST');
    expect(invitation?.url).toBe('/v3/smtp/email');
    expect(invitation?.headers['api-key']).toBe(API_KEY);
    expect(invitation?.body.sender).toEqual({
      name: 'SmartPack Test',
      email: 'sender@example.test',
    });
    expect(invitation?.body.subject).toMatch(/invited/i);
    expect(invitation?.body.htmlContent).toContain('accept-invitation#token=');
    const inviteToken = tokenIn(invitation?.body.textContent ?? '');

    const accepted = await world.api.post('/invitations/accept', {
      token: inviteToken,
      accountExists: false,
      firstName: 'Tunde',
      lastName: 'Bello',
      password: STRONG_PASSWORD,
    });
    expect(accepted.status).toBe(201);

    // 2. Email verification. Accepting the invitation already proves the address, so clear that
    // first (the same technique the existing auth tests use) to exercise a real verification mail.
    await world.db.db.execute(
      sql`update users set email_verified_at = null where email_normalized = ${invitee}`,
    );
    const memberCookie = await world.api.login(invitee);
    const resent = await world.api.post<DeliveryResponse>(
      '/auth/email/resend-verification',
      {},
      memberCookie,
    );
    expect(resent.status).toBe(200);
    expect(resent.body.data.emailDelivery).toBe('sent');
    const verification = brevo.to(invitee).find((r) => /verify/i.test(r.body.subject));
    expect(verification).toBeDefined();
    const verifyToken = tokenIn(verification?.body.textContent ?? '');
    expect((await world.api.post('/auth/email/verify', { token: verifyToken })).status).toBe(200);
    expect(
      (await world.api.get<MeResponse>('/auth/me', memberCookie)).body.data.user.emailVerified,
    ).toBe(true);

    // 3. Password reset (sent in the background, so wait for it).
    expect((await world.api.post('/auth/password/forgot', { email: invitee })).status).toBe(202);
    const reset = await eventually(() =>
      brevo.to(invitee).find((r) => /reset/i.test(r.body.subject)),
    );
    const resetToken = tokenIn(reset.body.textContent);
    const newPassword = 'Brand-New-Secret-91';
    expect(
      (await world.api.post('/auth/password/reset', { token: resetToken, newPassword })).status,
    ).toBe(200);
    expect(
      (await world.api.post('/auth/login', { email: invitee, password: newPassword })).status,
    ).toBe(200);

    // The delivery log records real provider message ids and never the key or the links.
    const rows = await world.db.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.toEmail, invitee));
    // (A password-changed notice follows the reset, in the background.)
    expect(rows.map((r) => r.template)).toEqual(
      expect.arrayContaining(['email_verification', 'invitation', 'password_reset']),
    );
    for (const row of rows) {
      expect(row.status).toBe('sent');
      expect(row.provider).toBe('brevo');
      expect(row.providerMessageId).toMatch(/@brevo\.test>$/);
      expect(JSON.stringify(row)).not.toContain(API_KEY);
      expect(JSON.stringify(row)).not.toContain('#token=');
    }
  });

  it('does not expose the development mailbox with this provider', async () => {
    expect((await world.api.get('/dev/mailbox')).status).toBe(404);
  });

  it('reports a Brevo refusal as failed, keeps the invitation, and logs no secret', async () => {
    const org = await createOrg(world);
    const cookie = await world.api.login(org.owner.email);
    const invitee = `${unique('refused')}@example.test`;
    brevo.status = 400;
    try {
      const created = await world.api.post<InvitationResponse>(
        '/organizations/current/invitations',
        { email: invitee, role: 'worker' },
        cookie,
      );
      expect(created.status).toBe(201);
      expect(created.body.data.emailDelivery).toBe('failed');
      expect(created.body.data.invitation.status).toBe('pending');
    } finally {
      brevo.status = 201;
    }
    const [row] = await world.db.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.toEmail, invitee));
    expect(row?.status).toBe('failed');
    expect(row?.error).toContain('HTTP 400');
    expect(JSON.stringify(row)).not.toContain(API_KEY);
  });

  it('reports a rejected API key as failed with an actionable reason', async () => {
    const wrongKeyWorld = await startWorld({
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'xkeysib-wrong-key-0123456789abcdef0123',
      BREVO_API_BASE_URL: brevo.origin,
      EMAIL_SENDER_EMAIL: 'sender@example.test',
    });
    try {
      const org = await createOrg(wrongKeyWorld);
      const cookie = await wrongKeyWorld.api.login(org.owner.email);
      const invitee = `${unique('wrongkey')}@example.test`;
      const created = await wrongKeyWorld.api.post<InvitationResponse>(
        '/organizations/current/invitations',
        { email: invitee, role: 'worker' },
        cookie,
      );
      expect(created.body.data.emailDelivery).toBe('failed');
      const [row] = await wrongKeyWorld.db.db
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.toEmail, invitee));
      expect(row?.error).toContain('check BREVO_API_KEY');
      expect(JSON.stringify(row)).not.toContain('wrong-key');
    } finally {
      await wrongKeyWorld.close();
    }
  });

  it('reports failed, not sent, when Brevo cannot be reached', async () => {
    const downWorld = await startWorld({
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: API_KEY,
      BREVO_API_BASE_URL: 'http://127.0.0.1:1',
      EMAIL_SENDER_EMAIL: 'sender@example.test',
    });
    try {
      const org = await createOrg(downWorld);
      const cookie = await downWorld.api.login(org.owner.email);
      const created = await downWorld.api.post<InvitationResponse>(
        '/organizations/current/invitations',
        { email: `${unique('down')}@example.test`, role: 'worker' },
        cookie,
      );
      expect(created.status).toBe(201);
      expect(created.body.data.emailDelivery).toBe('failed');
    } finally {
      await downWorld.close();
    }
  });
});
