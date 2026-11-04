import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { and, eq, sql } from 'drizzle-orm';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '@smartpack/shared';
import {
  auditLogs,
  invitations,
  permissions,
  rolePermissions,
  roles,
} from '../src/database/schema/index.js';
import {
  addMember,
  createOrg,
  startWorld,
  STRONG_PASSWORD,
  unique,
  type TestOrg,
  type World,
} from './harness.js';

const MEMBERS = '/organizations/current/members';
const INVITES = '/organizations/current/invitations';

describe('access control, members and invitations', () => {
  let world: World;
  let org: TestOrg;
  let owner: string;

  beforeAll(async () => {
    world = await startWorld();
    org = await createOrg(world);
    owner = await world.api.login(org.owner.email);
  });
  afterAll(async () => {
    await world.close();
  });

  describe('reference data', () => {
    it('seeds exactly the permissions and roles defined in the shared package', async () => {
      const dbPermissions = (await world.db.db.select().from(permissions)).map((p) => p.key).sort();
      expect(dbPermissions).toEqual(PERMISSION_DEFINITIONS.map((p) => p.key).sort());
      const dbRoles = await world.db.db.select().from(roles);
      expect(dbRoles.map((r) => r.key).sort()).toEqual(ROLE_DEFINITIONS.map((r) => r.key).sort());
      for (const definition of ROLE_DEFINITIONS) {
        const role = dbRoles.find((r) => r.key === definition.key)!;
        const granted = await world.db.db
          .select({ key: rolePermissions.permissionKey })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, role.id));
        expect(granted.map((g) => g.key).sort()).toEqual([...definition.permissions].sort());
      }
    });

    it('lists roles with an assignable flag that reflects the caller', async () => {
      const worker = await addMember(world, owner, 'worker');
      const ownerView = await world.api.get('/organizations/current/roles', owner);
      const roles = ownerView.body.data.items as Array<{ assignable: boolean }>;
      expect(roles.every((r) => r.assignable)).toBe(true);
      const workerCookie = await world.api.login(worker.email);
      expect((await world.api.get('/organizations/current/roles', workerCookie)).status).toBe(403);
    });
  });

  describe('permissions', () => {
    it('denies a worker every administrative endpoint and allows own profile', async () => {
      const worker = await addMember(world, owner, 'worker');
      const cookie = await world.api.login(worker.email);
      expect((await world.api.get(MEMBERS, cookie)).status).toBe(403);
      expect((await world.api.get(INVITES, cookie)).status).toBe(403);
      expect((await world.api.get('/organizations/current/audit-logs', cookie)).status).toBe(403);
      expect(
        (await world.api.post(INVITES, { email: 'x@example.test', role: 'worker' }, cookie)).status,
      ).toBe(403);
      expect(
        (await world.api.patch('/organizations/current', { name: 'Hacked' }, cookie)).status,
      ).toBe(403);
      expect((await world.api.get('/auth/me', cookie)).status).toBe(200);
      expect((await world.api.get('/organizations/current', cookie)).status).toBe(200);
    });

    it('lets an auditor read the audit log but not change anything', async () => {
      const auditor = await addMember(world, owner, 'auditor');
      const cookie = await world.api.login(auditor.email);
      expect((await world.api.get('/organizations/current/audit-logs', cookie)).status).toBe(200);
      expect(
        (await world.api.post(INVITES, { email: 'y@example.test', role: 'worker' }, cookie)).status,
      ).toBe(403);
    });

    it('stops an administrator creating or touching owners (no privilege escalation)', async () => {
      const admin = await addMember(world, owner, 'admin');
      const adminCookie = await world.api.login(admin.email);
      const invite = await world.api.post(
        INVITES,
        { email: `${unique('o')}@example.test`, role: 'owner' },
        adminCookie,
      );
      expect(invite.status).toBe(403);

      const worker = await addMember(world, owner, 'worker');
      const promote = await world.api.patch(
        `${MEMBERS}/${worker.memberId}/role`,
        { role: 'owner' },
        adminCookie,
      );
      expect(promote.status).toBe(403);

      const ownerMember = (await world.api.get(`${MEMBERS}?role=owner`, owner)).body.data
        .items[0] as { id: string };
      expect(
        (
          await world.api.patch(
            `${MEMBERS}/${ownerMember.id}/role`,
            { role: 'worker' },
            adminCookie,
          )
        ).status,
      ).toBe(403);
      expect(
        (await world.api.post(`${MEMBERS}/${ownerMember.id}/suspend`, {}, adminCookie)).status,
      ).toBe(403);
      expect((await world.api.del(`${MEMBERS}/${ownerMember.id}`, adminCookie)).status).toBe(403);
    });

    it('does not let anyone change their own role, suspend or remove themselves', async () => {
      const admin = await addMember(world, owner, 'admin');
      const cookie = await world.api.login(admin.email);
      expect(
        (await world.api.patch(`${MEMBERS}/${admin.memberId}/role`, { role: 'worker' }, cookie))
          .status,
      ).toBe(403);
      expect(
        (await world.api.post(`${MEMBERS}/${admin.memberId}/suspend`, {}, cookie)).status,
      ).toBe(403);
      expect((await world.api.del(`${MEMBERS}/${admin.memberId}`, cookie)).status).toBe(403);
    });

    it('rejects an unknown role key and unknown body fields', async () => {
      const worker = await addMember(world, owner, 'worker');
      expect(
        (await world.api.patch(`${MEMBERS}/${worker.memberId}/role`, { role: 'superuser' }, owner))
          .status,
      ).toBe(400);
      expect(
        (
          await world.api.patch(
            '/organizations/current',
            { name: 'Ok Name', slug: 'new-slug' },
            owner,
          )
        ).status,
      ).toBe(400);
      expect(
        (await world.api.patch('/organizations/current', { timeZone: 'Mars/Olympus' }, owner))
          .status,
      ).toBe(400);
      expect((await world.api.get(`${MEMBERS}/not-a-uuid`, owner)).status).toBe(400);
    });
  });

  describe('last owner protection', () => {
    it('refuses to remove the only owner path and survives two owners demoting each other at once', async () => {
      const local = await createOrg(world);
      const first = await world.api.login(local.owner.email);
      const second = await addMember(world, first, 'admin');
      const promoted = await world.api.patch(
        `${MEMBERS}/${second.memberId}/role`,
        { role: 'owner' },
        first,
      );
      expect(promoted.status).toBe(200);
      const secondCookie = await world.api.login(second.email);

      const ownerRows = (await world.api.get(`${MEMBERS}?role=owner&pageSize=10`, first)).body.data
        .items as Array<{ id: string; email: string }>;
      const firstMemberId = ownerRows.find((m) => m.email === local.owner.email)?.id;

      const [a, b] = await Promise.all([
        world.api.patch(`${MEMBERS}/${second.memberId}/role`, { role: 'worker' }, first),
        world.api.patch(`${MEMBERS}/${firstMemberId}/role`, { role: 'worker' }, secondCookie),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses[0]).toBe(200);
      expect(statuses[1]).not.toBe(200);

      const owners = await world.db.db.execute(sql`
        select count(*)::int as n from memberships m join roles r on r.id = m.role_id
        where m.organization_id = ${local.organizationId} and r.key = 'owner' and m.status = 'active'`);
      expect((owners.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(1);
    });
  });

  describe('suspension and removal', () => {
    it('ends sessions immediately, blocks sign-in, and reactivation restores access', async () => {
      const worker = await addMember(world, owner, 'worker');
      const cookie = await world.api.login(worker.email);
      expect((await world.api.get('/auth/me', cookie)).status).toBe(200);

      const suspended = await world.api.post(`${MEMBERS}/${worker.memberId}/suspend`, {}, owner);
      expect(suspended.status).toBe(200);
      expect(suspended.body.data.status).toBe('suspended');
      expect((await world.api.get('/auth/me', cookie)).status).toBe(401);
      const denied = await world.api.post('/auth/login', {
        email: worker.email,
        password: STRONG_PASSWORD,
      });
      expect(denied.status).toBe(401);
      expect(denied.body.error.code).toBe('INVALID_CREDENTIALS');

      expect(
        (await world.api.post(`${MEMBERS}/${worker.memberId}/reactivate`, {}, owner)).status,
      ).toBe(200);
      await world.api.login(worker.email);
    });

    it('removes a member, revokes sessions, and a new invitation brings them back', async () => {
      const worker = await addMember(world, owner, 'supervisor');
      const cookie = await world.api.login(worker.email);
      expect((await world.api.del(`${MEMBERS}/${worker.memberId}`, owner)).status).toBe(200);
      expect((await world.api.get('/auth/me', cookie)).status).toBe(401);
      expect(
        (await world.api.get(`${MEMBERS}?search=${encodeURIComponent(worker.email)}`, owner)).body
          .data.items,
      ).toHaveLength(0);

      const invite = await world.api.post(INVITES, { email: worker.email, role: 'worker' }, owner);
      expect(invite.status).toBe(201);
      const token = await world.api.latestToken(worker.email);
      const accepted = await world.api.post('/invitations/accept', {
        token,
        accountExists: true,
        password: STRONG_PASSWORD,
      });
      expect(accepted.status).toBe(201);
      const me = await world.api.get('/auth/me', await world.api.login(worker.email));
      expect(me.body.data.membership.role.key).toBe('worker');
    });
  });

  describe('invitations', () => {
    it('creates an invitation whose emailed link carries the token only in the fragment', async () => {
      const email = `${unique('inv')}@example.test`;
      const created = await world.api.post(INVITES, { email, role: 'asset_manager' }, owner);
      expect(created.status).toBe(201);
      expect(created.body.data.emailDelivery).toBe('sent');
      expect(created.body.data.invitation.status).toBe('pending');
      expect(JSON.stringify(created.body)).not.toMatch(/[A-Za-z0-9_-]{43}/);
      const message = (await world.api.mailbox()).find((m) => m.to === email)!;
      expect(message.text).toMatch(/\/accept-invitation#token=[A-Za-z0-9_-]{43}/);
      expect(message.text).not.toMatch(/\?token=/);
    });

    it('rejects a duplicate pending invitation and inviting an existing member', async () => {
      const email = `${unique('dup')}@example.test`;
      expect((await world.api.post(INVITES, { email, role: 'worker' }, owner)).status).toBe(201);
      expect(
        (await world.api.post(INVITES, { email: email.toUpperCase(), role: 'worker' }, owner))
          .status,
      ).toBe(409);
      expect(
        (await world.api.post(INVITES, { email: org.owner.email, role: 'worker' }, owner)).status,
      ).toBe(409);
    });

    it('previews a link, accepts once, and does not sign anyone in', async () => {
      const email = `${unique('new')}@example.test`;
      await world.api.post(INVITES, { email, role: 'worker' }, owner);
      const token = await world.api.latestToken(email);
      const preview = await world.api.post('/invitations/preview', { token });
      expect(preview.status).toBe(200);
      expect(preview.body.data.accountExists).toBe(false);
      expect(preview.body.data.email).toBe(email);

      const accept = await world.api.post('/invitations/accept', {
        token,
        accountExists: false,
        firstName: 'Ngozi',
        lastName: 'Eze',
        password: STRONG_PASSWORD,
      });
      expect(accept.status).toBe(201);
      expect(accept.rawSetCookie).toBeUndefined();
      const again = await world.api.post('/invitations/accept', {
        token,
        accountExists: false,
        firstName: 'Ngozi',
        lastName: 'Eze',
        password: STRONG_PASSWORD,
      });
      expect(again.status).toBe(400);
      expect(again.body.error.code).toBe('INVALID_TOKEN');
    });

    it('lets only one of two simultaneous acceptances succeed', async () => {
      const email = `${unique('race')}@example.test`;
      await world.api.post(INVITES, { email, role: 'worker' }, owner);
      const token = await world.api.latestToken(email);
      const body = {
        token,
        accountExists: false,
        firstName: 'Race',
        lastName: 'Winner',
        password: STRONG_PASSWORD,
      };
      const results = await Promise.all([
        world.api.post('/invitations/accept', body),
        world.api.post('/invitations/accept', body),
        world.api.post('/invitations/accept', body),
      ]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      const members = await world.api.get(`${MEMBERS}?search=${encodeURIComponent(email)}`, owner);
      expect(members.body.data.items).toHaveLength(1);
    });

    it('requires the current password to accept for an existing account', async () => {
      const second = await createOrg(world);
      const secondOwner = await world.api.login(second.owner.email);
      await world.api.post(INVITES, { email: org.owner.email, role: 'auditor' }, secondOwner);
      const token = await world.api.latestToken(org.owner.email);
      const preview = await world.api.post('/invitations/preview', { token });
      expect(preview.body.data.accountExists).toBe(true);
      const wrong = await world.api.post('/invitations/accept', {
        token,
        accountExists: true,
        password: 'wrong-password-123',
      });
      expect(wrong.status).toBe(401);
      const ok = await world.api.post('/invitations/accept', {
        token,
        accountExists: true,
        password: STRONG_PASSWORD,
      });
      expect(ok.status).toBe(201);
      // The account now belongs to two companies, so sign-in needs to say which.
      const ambiguous = await world.api.post('/auth/login', {
        email: org.owner.email,
        password: STRONG_PASSWORD,
      });
      expect(ambiguous.status).toBe(400);
      const cookie = await world.api.login(org.owner.email, STRONG_PASSWORD, second.slug);
      expect((await world.api.get('/auth/me', cookie)).body.data.organization.slug).toBe(
        second.slug,
      );
    });

    it('rejects an expired invitation and reports it as expired in the list', async () => {
      const email = `${unique('exp')}@example.test`;
      const created = await world.api.post(INVITES, { email, role: 'worker' }, owner);
      const token = await world.api.latestToken(email);
      await world.db.db
        .update(invitations)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(invitations.id, created.body.data.invitation.id as string));
      expect((await world.api.post('/invitations/preview', { token })).status).toBe(400);
      expect(
        (
          await world.api.post('/invitations/accept', {
            token,
            accountExists: false,
            firstName: 'A',
            lastName: 'B',
            password: STRONG_PASSWORD,
          })
        ).status,
      ).toBe(400);
      const list = await world.api.get(`${INVITES}?status=expired&pageSize=100`, owner);
      const listed = list.body.data.items as Array<{ id: string }>;
      expect(listed.some((i) => i.id === created.body.data.invitation.id)).toBe(true);
      // An expired invitation must not block a fresh one for the same address.
      expect((await world.api.post(INVITES, { email, role: 'worker' }, owner)).status).toBe(201);
    });

    it('resend replaces the link; revoke kills it', async () => {
      const email = `${unique('rs')}@example.test`;
      const created = await world.api.post(INVITES, { email, role: 'worker' }, owner);
      const first = await world.api.latestToken(email);
      const id = created.body.data.invitation.id as string;
      expect((await world.api.post(`${INVITES}/${id}/resend`, {}, owner)).status).toBe(200);
      const second = await world.api.latestToken(email);
      expect(second).not.toBe(first);
      expect((await world.api.post('/invitations/preview', { token: first })).status).toBe(400);
      expect((await world.api.post('/invitations/preview', { token: second })).status).toBe(200);

      expect((await world.api.del(`${INVITES}/${id}`, owner)).status).toBe(200);
      expect((await world.api.post('/invitations/preview', { token: second })).status).toBe(400);
      expect((await world.api.del(`${INVITES}/${id}`, owner)).status).toBe(409);
    });

    it('stores only a hash of the token', async () => {
      const email = `${unique('hash')}@example.test`;
      await world.api.post(INVITES, { email, role: 'worker' }, owner);
      const token = await world.api.latestToken(email);
      const rows = await world.db.db
        .select()
        .from(invitations)
        .where(eq(invitations.emailNormalized, email));
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it('enforces password policy on acceptance', async () => {
      const email = `${unique('pol')}@example.test`;
      await world.api.post(INVITES, { email, role: 'worker' }, owner);
      const token = await world.api.latestToken(email);
      const weak = await world.api.post('/invitations/accept', {
        token,
        accountExists: false,
        firstName: 'Weak',
        lastName: 'Pass',
        password: 'password1234',
      });
      expect(weak.status).toBe(400);
      // The link survives a rejected attempt.
      expect((await world.api.post('/invitations/preview', { token })).status).toBe(200);
    });
  });

  describe('company isolation', () => {
    it('never reveals or modifies another company’s data', async () => {
      const other = await createOrg(world);
      const otherOwner = await world.api.login(other.owner.email);
      const theirs = await addMember(world, otherOwner, 'worker');
      const theirInvite = await world.api.post(
        INVITES,
        { email: `${unique('t')}@example.test`, role: 'worker' },
        otherOwner,
      );

      expect((await world.api.get(`${MEMBERS}/${theirs.memberId}`, owner)).status).toBe(404);
      expect(
        (await world.api.patch(`${MEMBERS}/${theirs.memberId}/role`, { role: 'admin' }, owner))
          .status,
      ).toBe(404);
      expect(
        (await world.api.post(`${MEMBERS}/${theirs.memberId}/suspend`, {}, owner)).status,
      ).toBe(404);
      expect((await world.api.del(`${MEMBERS}/${theirs.memberId}`, owner)).status).toBe(404);
      expect(
        (
          await world.api.post(
            `${INVITES}/${theirInvite.body.data.invitation.id}/resend`,
            {},
            owner,
          )
        ).status,
      ).toBe(404);
      expect(
        (await world.api.del(`${INVITES}/${theirInvite.body.data.invitation.id}`, owner)).status,
      ).toBe(404);

      const mine = await world.api.get(`${MEMBERS}?pageSize=100`, owner);
      const myMembers = mine.body.data.items as Array<{ email: string }>;
      expect(myMembers.some((m) => m.email === theirs.email)).toBe(false);
      const audit = await world.api.get('/organizations/current/audit-logs?limit=100', owner);
      expect(JSON.stringify(audit.body)).not.toContain(other.organizationId);
      expect(JSON.stringify(audit.body)).not.toContain(theirs.email);

      // Untouched on their side.
      expect(
        (await world.api.get(`${MEMBERS}/${theirs.memberId}`, otherOwner)).body.data.status,
      ).toBe('active');
    });

    it('ignores any attempt to name a company in the request', async () => {
      const other = await createOrg(world);
      const response = await world.api.request(
        'GET',
        `/organizations/current?organizationId=${other.organizationId}`,
        {
          cookie: owner,
          headers: { 'x-organization-id': other.organizationId },
        },
      );
      expect(response.body.data.id).toBe(org.organizationId);
    });
  });

  describe('company profile', () => {
    it('lets an owner update the company and records it', async () => {
      const local = await createOrg(world);
      const cookie = await world.api.login(local.owner.email);
      const updated = await world.api.patch(
        '/organizations/current',
        { name: 'Renamed Logistics', timeZone: 'Africa/Lagos', country: 'NG' },
        cookie,
      );
      expect(updated.status).toBe(200);
      expect(updated.body.data).toMatchObject({
        name: 'Renamed Logistics',
        timeZone: 'Africa/Lagos',
        country: 'NG',
        slug: local.slug,
      });
      const rows = await world.db.db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.organizationId, local.organizationId),
            eq(auditLogs.action, 'organization.updated'),
          ),
        );
      expect(rows).toHaveLength(1);
    });
  });

  describe('audit log', () => {
    it('records administrative events with cursor pagination and no secrets', async () => {
      const local = await createOrg(world);
      const cookie = await world.api.login(local.owner.email);
      for (let i = 0; i < 4; i += 1) {
        await world.api.post(
          INVITES,
          { email: `${unique('a')}@example.test`, role: 'worker' },
          cookie,
        );
      }
      const page1 = await world.api.get(
        '/organizations/current/audit-logs?limit=2&action=invitation.created',
        cookie,
      );
      expect(page1.status).toBe(200);
      expect(page1.body.data.items).toHaveLength(2);
      expect(page1.body.data.nextCursor).toBeTruthy();
      const page2 = await world.api.get(
        `/organizations/current/audit-logs?limit=10&action=invitation.created&cursor=${page1.body.data.nextCursor}`,
        cookie,
      );
      expect(page2.body.data.items).toHaveLength(2);
      expect(page2.body.data.nextCursor).toBeNull();
      const ids = [
        ...(page1.body.data.items as Array<{ id: string }>),
        ...(page2.body.data.items as Array<{ id: string }>),
      ].map((i) => i.id);
      expect(new Set(ids).size).toBe(4);
      expect(JSON.stringify([page1.body, page2.body])).not.toMatch(/ipAddress|token|passwordHash/i);
      expect(
        (await world.api.get('/organizations/current/audit-logs?limit=500', cookie)).status,
      ).toBe(400);
      expect(
        (await world.api.get('/organizations/current/audit-logs?cursor=abc', cookie)).status,
      ).toBe(400);
    });

    it('is append-only: updates, deletes and truncation are rejected by the database', async () => {
      const [row] = await world.db.db.select({ id: auditLogs.id }).from(auditLogs).limit(1);
      await expect(
        world.db.db.execute(sql`update audit_logs set action = 'x' where id = ${row!.id}`),
      ).rejects.toThrow();
      await expect(
        world.db.db.execute(sql`delete from audit_logs where id = ${row!.id}`),
      ).rejects.toThrow();
      await expect(world.db.db.execute(sql`truncate audit_logs`)).rejects.toThrow();
    });

    it('refuses to write forbidden metadata keys', async () => {
      const { AuditService } = await import('../src/audit/audit.service.js');
      const audit = world.app.get(AuditService);
      await expect(
        audit.record(
          world.db.db,
          { category: 'system', action: 'x', metadata: { password: 'nope' } },
          { requestId: 'r', ip: '127.0.0.1', userAgent: null },
        ),
      ).rejects.toThrow(/not allowed/);
    });
  });
});
