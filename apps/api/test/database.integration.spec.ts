import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import {
  BootstrapError,
  provisionFirstOwner,
  slugFromName,
} from '../src/bootstrap/bootstrap.service.js';
import { loadDatabaseConfig } from '../src/config/app-config.js';
import { runMigrations } from '../src/database/run-migrations.js';
import * as schema from '../src/database/schema/index.js';
import {
  memberships,
  organizations,
  roles,
  sessions,
  users,
} from '../src/database/schema/index.js';
import { pgErrorOf } from '../src/database/pg-errors.js';
import { PasswordHasher } from '../src/security/password-hasher.js';
import { createOrg, startWorld, STRONG_PASSWORD, unique, type World } from './harness.js';
import { testConfig, testDatabaseUrl } from './helpers.js';

/** Asserts that the database refused the statement, with the given SQLSTATE and optional constraint. */
async function expectDbError(
  work: PromiseLike<unknown>,
  code: string,
  constraint?: string,
): Promise<void> {
  const error = await Promise.resolve(work).then(
    () => undefined,
    (e: unknown) => e ?? new Error('rejected without an error'),
  );
  expect(error).toBeDefined();
  const found = pgErrorOf(error);
  expect(found.code).toBe(code);
  if (constraint) expect(found.constraint).toBe(constraint);
}

function urlWithDatabase(name: string): string {
  const url = new URL(testDatabaseUrl());
  url.pathname = `/${name}`;
  return url.toString();
}

/** The first row of a result, failing the test with a clear message when there is none. */
function firstRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error('The query returned no rows.');
  return row;
}

describe('database constraints', () => {
  let world: World;
  beforeAll(async () => {
    world = await startWorld();
  });
  afterAll(async () => {
    await world.close();
  });

  const insertUser = (email: string, normalized = email.toLowerCase()) =>
    world.db.db.insert(users).values({
      email,
      emailNormalized: normalized,
      passwordHash: 'x',
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
    });

  it('keeps one account per address regardless of case', async () => {
    const email = `${unique('Case')}@Example.test`;
    await insertUser(email);
    await expectDbError(insertUser(email.toUpperCase()), '23505', 'users_email_normalized_key');
  });

  it('rejects a non-normalised stored address and blank names', async () => {
    await expectDbError(
      insertUser('Mixed@Example.test', 'Mixed@Example.test'),
      '23514',
      'users_email_normalized_form',
    );
    const email = `${unique('b')}@example.test`;
    await expectDbError(
      world.db.db.insert(users).values({
        email,
        emailNormalized: email,
        passwordHash: 'x',
        firstName: ' ',
        lastName: 'B',
        displayName: 'B',
      }),
      '23514',
      'users_names_not_blank',
    );
  });

  it('validates organization slug, name and status', async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ slug: 'Bad Slug' }, 'organizations_slug_format'],
      [{ slug: 'a' }, 'organizations_slug_format'],
      [{ slug: '-lead' }, 'organizations_slug_format'],
      [{ name: 'x' }, 'organizations_name_length'],
      [{ status: 'deleted' }, 'organizations_status_valid'],
    ];
    for (const [bad, constraint] of cases) {
      await expectDbError(
        world.db.db
          .insert(organizations)
          .values({ name: 'Valid Name', slug: unique('slug'), ...bad }),
        '23514',
        constraint,
      );
    }
  });

  it('allows one membership per person per company', async () => {
    const org = await createOrg(world);
    const [role] = await world.db.db.select().from(roles).limit(1);
    await expectDbError(
      world.db.db
        .insert(memberships)
        .values({ organizationId: org.organizationId, userId: org.owner.id, roleId: role!.id }),
      '23505',
      'memberships_organization_user_key',
    );
  });

  it('refuses to delete records that history depends on (RESTRICT)', async () => {
    const org = await createOrg(world);
    await expectDbError(
      world.db.db.execute(sql`delete from organizations where id = ${org.organizationId}`),
      '23503',
    );
    await expectDbError(
      world.db.db.execute(sql`delete from users where id = ${org.owner.id}`),
      '23503',
    );
    await expectDbError(world.db.db.execute(sql`delete from roles where key = 'owner'`), '23503');
  });

  it('rejects a session that points at a membership that does not exist', async () => {
    const org = await createOrg(world);
    await expectDbError(
      world.db.db.insert(sessions).values({
        userId: org.owner.id,
        membershipId: '00000000-0000-0000-0000-000000000000',
        tokenHash: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      }),
      '23503',
    );
  });
});

describe('clean database: migrations and bootstrap', () => {
  const name = `smartpack_tmp_${randomBytes(4).toString('hex')}`;
  let admin: pg.Client;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let pool: pg.Pool;
  const hasher = new PasswordHasher(
    testConfig({ ARGON2_MEMORY_KIB: '1024', ARGON2_TIME_COST: '1' }),
  );

  const owner = (overrides: Partial<Parameters<typeof provisionFirstOwner>[2]> = {}) => ({
    organizationName: 'Northwind Haulage',
    ownerEmail: 'founder@northwind.example',
    ownerFirstName: 'Chidi',
    ownerLastName: 'Nwosu',
    password: STRONG_PASSWORD,
    ...overrides,
  });

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: testDatabaseUrl() });
    await admin.connect();
    await admin.query(`create database ${name}`);
    const config = loadDatabaseConfig({
      DATABASE_URL: urlWithDatabase(name),
      DATABASE_SSL: 'disable',
    });
    await runMigrations(config);
    pool = new pg.Pool({ connectionString: urlWithDatabase(name) });
    // Dropping the database at the end terminates its connections; that is expected, not a failure.
    pool.on('error', () => undefined);
    db = drizzle(pool, { schema });
  });
  afterAll(async () => {
    await pool.end();
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  });

  it('creates every table and seeds reference data from nothing', async () => {
    const tables = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' order by 1",
    );
    const names = tables.rows.map((r) => r.table_name);
    for (const expected of [
      'organizations',
      'users',
      'memberships',
      'roles',
      'permissions',
      'role_permissions',
      'sessions',
      'invitations',
      'password_reset_tokens',
      'email_verification_tokens',
      'audit_logs',
      'email_deliveries',
    ]) {
      expect(names).toContain(expected);
    }
    const seeded = await pool.query<{ n: number }>('select count(*)::int as n from roles');
    expect(firstRow(seeded.rows).n).toBe(7);
  });

  it('is idempotent: running migrations again changes nothing', async () => {
    const before = await pool.query<{ n: number }>(
      'select count(*)::int as n from drizzle.__drizzle_migrations',
    );
    await runMigrations(
      loadDatabaseConfig({
        DATABASE_URL: urlWithDatabase(name),
        DATABASE_SSL: 'disable',
      }),
    );
    const after = await pool.query<{ n: number }>(
      'select count(*)::int as n from drizzle.__drizzle_migrations',
    );
    expect(firstRow(after.rows).n).toBe(firstRow(before.rows).n);
  });

  it('refuses weak passwords and bad input and creates nothing', async () => {
    await expect(
      provisionFirstOwner(db, hasher, owner({ password: 'short' })),
    ).rejects.toMatchObject({ reason: 'invalid_input' });
    await expect(
      provisionFirstOwner(db, hasher, owner({ password: 'Chidi-Nwosu-2026!' })),
    ).rejects.toMatchObject({ reason: 'invalid_input' });
    await expect(
      provisionFirstOwner(db, hasher, owner({ ownerEmail: 'nope' })),
    ).rejects.toMatchObject({ reason: 'invalid_input' });
    await expect(
      provisionFirstOwner(db, hasher, owner({ timeZone: 'Mars/Base' })),
    ).rejects.toMatchObject({ reason: 'invalid_input' });
    expect(
      firstRow(
        (await pool.query<{ n: number }>('select count(*)::int as n from organizations')).rows,
      ).n,
    ).toBe(0);
  });

  it('lets exactly one of several simultaneous bootstrap runs succeed', async () => {
    const attempts = await Promise.allSettled([
      provisionFirstOwner(db, hasher, owner({ ownerEmail: 'a@northwind.example' })),
      provisionFirstOwner(
        db,
        hasher,
        owner({ ownerEmail: 'b@northwind.example', organizationName: 'Other Co' }),
      ),
      provisionFirstOwner(
        db,
        hasher,
        owner({ ownerEmail: 'c@northwind.example', organizationName: 'Third Co' }),
      ),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    for (const failed of attempts.filter((a) => a.status === 'rejected')) {
      const reason: unknown = failed.reason;
      expect(reason).toBeInstanceOf(BootstrapError);
      expect((reason as BootstrapError).reason).toBe('already_provisioned');
    }
    expect(
      firstRow(
        (await pool.query<{ n: number }>('select count(*)::int as n from organizations')).rows,
      ).n,
    ).toBe(1);
    expect(
      firstRow((await pool.query<{ n: number }>('select count(*)::int as n from memberships')).rows)
        .n,
    ).toBe(1);
  });

  it('creates an Owner with a hashed password, an audit event and an unverified address by default', async () => {
    const rows = (
      await pool.query<{
        password_hash: string;
        email_verified_at: Date | null;
        role: string;
      }>(`select u.password_hash, u.email_verified_at, r.key as role
        from users u join memberships m on m.user_id = u.id join roles r on r.id = m.role_id`)
    ).rows;
    const row = firstRow(rows);
    expect(row.role).toBe('owner');
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect(row.password_hash).not.toContain(STRONG_PASSWORD);
    expect(row.email_verified_at).toBeNull();
    const audit = await pool.query(
      "select action, request_id, metadata from audit_logs where action = 'system.bootstrap'",
    );
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows)).not.toContain(STRONG_PASSWORD);
  });

  it('refuses to run again on an installation that has a company', async () => {
    await expect(
      provisionFirstOwner(db, hasher, owner({ ownerEmail: 'late@northwind.example' })),
    ).rejects.toMatchObject({
      reason: 'already_provisioned',
    });
  });
});

describe('slugFromName', () => {
  it.each([
    ['Northwind Haulage', 'northwind-haulage'],
    ['  Zoë & Sons, Ltd. ', 'zoe-sons-ltd'],
    ['A'.repeat(80), 'a'.repeat(48)],
  ])('%s -> %s', (input, expected) => {
    expect(slugFromName(input)).toBe(expected);
  });
});
