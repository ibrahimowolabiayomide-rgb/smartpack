import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { provisionFirstOwner } from '../src/bootstrap/bootstrap.service.js';
import type { AppConfig } from '../src/config/app-config.js';
import { DatabaseService } from '../src/database/database.service.js';
import { PasswordHasher } from '../src/security/password-hasher.js';
import { createTestApp, migrateTestDatabase, testConfig } from './helpers.js';

export const WEB_ORIGIN = 'http://localhost:3000';
export const STRONG_PASSWORD = 'Sturdy-Lantern-Harbor-42';

/**
 * The parsed JSON of a response. Every test asserts on the exact shape it expects, so the body is
 * deliberately loosely typed here; this is the single place the project allows `any` in tests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see the comment above
export type JsonBody = any;

export interface ApiResponse<T = JsonBody> {
  status: number;
  body: T;
  headers: Record<string, string | string[] | undefined>;
  /** `name=value` of the session cookie when the response set one. */
  cookie?: string;
  rawSetCookie?: string;
}

export class Api {
  constructor(readonly app: NestFastifyApplication) {}

  async request<T = JsonBody>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    options: {
      body?: unknown;
      cookie?: string;
      headers?: Record<string, string>;
      origin?: string | null;
    } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.cookie) headers.cookie = options.cookie;
    if (options.origin !== null && method !== 'GET' && options.origin !== undefined) {
      headers.origin = options.origin;
    } else if (options.origin === undefined && method !== 'GET' && options.cookie) {
      headers.origin = WEB_ORIGIN;
    }
    let call = request(this.app.getHttpServer())[
      method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'
    ](`/api/v1${url}`);
    for (const [name, value] of Object.entries(headers)) call = call.set(name, value);
    if (options.body !== undefined) call = call.send(options.body as object);
    const response = await call;
    const setCookie = response.headers['set-cookie'] as string[] | string | undefined;
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return {
      status: response.status,
      body: response.body as T,
      headers: response.headers,
      cookie: raw?.split(';')[0],
      rawSetCookie: raw,
    };
  }

  get = <T = JsonBody>(url: string, cookie?: string) => this.request<T>('GET', url, { cookie });
  post = <T = JsonBody>(url: string, body?: unknown, cookie?: string) =>
    this.request<T>('POST', url, { body: body ?? {}, cookie });
  patch = <T = JsonBody>(url: string, body: unknown, cookie?: string) =>
    this.request<T>('PATCH', url, { body, cookie });
  del = <T = JsonBody>(url: string, cookie?: string) => this.request<T>('DELETE', url, { cookie });

  /** Signs in and returns the session cookie; throws with the response when it fails. */
  async login(
    email: string,
    password = STRONG_PASSWORD,
    organizationSlug?: string,
  ): Promise<string> {
    const response = await this.post('/auth/login', { email, password, organizationSlug });
    if (response.status !== 200 || !response.cookie) {
      throw new Error(
        `Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }
    return response.cookie;
  }

  async mailbox(): Promise<Array<{ to: string; subject: string; text: string }>> {
    const response = await this.get<{
      data: { messages: Array<{ to: string; subject: string; text: string }> };
    }>('/dev/mailbox');
    return response.body.data.messages;
  }

  /** The URL-fragment token from the newest message to `to`. */
  async latestToken(to: string): Promise<string> {
    const messages = (await this.mailbox()).filter((m) => m.to.toLowerCase() === to.toLowerCase());
    const last = messages[0]; // newest first
    const match = last?.text.match(/#token=([A-Za-z0-9_-]{43})/);
    if (!match?.[1]) throw new Error(`No token email for ${to}`);
    return match[1];
  }
}

export interface World {
  app: NestFastifyApplication;
  api: Api;
  config: AppConfig;
  db: DatabaseService;
  hasher: PasswordHasher;
  close(): Promise<void>;
}

export async function startWorld(overrides: Record<string, string> = {}): Promise<World> {
  await migrateTestDatabase();
  const config = testConfig({
    EMAIL_PROVIDER: 'dev-capture',
    WEB_APP_URL: WEB_ORIGIN,
    RATE_LIMIT_DISABLED: 'true',
    // Cheap hashing keeps the suite fast; production minimums are covered by config tests.
    ARGON2_MEMORY_KIB: '1024',
    ARGON2_TIME_COST: '1',
    ...overrides,
  });
  const app = await createTestApp(config);
  return {
    app,
    api: new Api(app),
    config,
    db: app.get(DatabaseService),
    hasher: app.get(PasswordHasher),
    close: () => app.close(),
  };
}

let counter = 0;
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${randomBytes(4).toString('hex')}${counter}`;
}

export interface TestOrg {
  organizationId: string;
  slug: string;
  owner: { id: string; email: string };
}

/** Creates an isolated company with an Owner through the real provisioning function. */
export async function createOrg(world: World, name = 'Acme Logistics'): Promise<TestOrg> {
  const tag = unique('org');
  const email = `owner-${tag}@example.test`;
  const result = await provisionFirstOwner(world.db.db, world.hasher, {
    organizationName: `${name} ${tag}`,
    organizationSlug: tag,
    ownerEmail: email,
    ownerFirstName: 'Ada',
    ownerLastName: 'Okafor',
    password: STRONG_PASSWORD,
    emailVerified: true,
    allowAdditionalOrganization: true,
  });
  return {
    organizationId: result.organizationId,
    slug: result.organizationSlug,
    owner: { id: result.ownerUserId, email },
  };
}

/** Invites someone as `role`, accepts it, and returns their credentials. */
export async function addMember(
  world: World,
  ownerCookie: string,
  role: string,
  firstName = 'Tunde',
): Promise<{ email: string; userId: string; memberId: string }> {
  const email = `${unique(role)}@example.test`;
  const created = await world.api.post(
    '/organizations/current/invitations',
    { email, role },
    ownerCookie,
  );
  if (created.status !== 201)
    throw new Error(`invite failed ${created.status} ${JSON.stringify(created.body)}`);
  const token = await world.api.latestToken(email);
  const accepted = await world.api.post('/invitations/accept', {
    token,
    accountExists: false,
    firstName,
    lastName: 'Bello',
    password: STRONG_PASSWORD,
  });
  if (accepted.status !== 201)
    throw new Error(`accept failed ${accepted.status} ${JSON.stringify(accepted.body)}`);
  const members = await world.api.get<{
    data: { items: Array<{ id: string; email: string; userId?: string; user?: { id: string } }> };
  }>('/organizations/current/members?pageSize=100', ownerCookie);
  const member = members.body.data.items.find((m) => m.email === email);
  if (!member) throw new Error(`member ${email} not listed after accepting the invitation`);
  const userId = member.userId ?? member.user?.id;
  if (!userId) throw new Error(`member ${email} has no user id in the listing`);
  return { email, userId, memberId: member.id };
}
