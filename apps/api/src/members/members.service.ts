import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { holdsAllPermissions, type Member, type RoleKey } from '@smartpack/shared';
import { and, asc, count, eq, ilike, ne, or, sql, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth-context.js';
import { SessionsService } from '../auth/sessions.service.js';
import type { RequestContext } from '../common/http/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import type { Transaction } from '../database/db-types.js';
import { memberships, organizations, roles, users } from '../database/schema/index.js';
import { RolesService } from '../roles/roles.service.js';

const memberColumns = {
  id: memberships.id,
  userId: users.id,
  email: users.email,
  displayName: users.displayName,
  firstName: users.firstName,
  lastName: users.lastName,
  emailVerifiedAt: users.emailVerifiedAt,
  status: memberships.status,
  roleKey: roles.key,
  roleName: roles.name,
  roleId: roles.id,
  lastLoginAt: users.lastLoginAt,
  activatedAt: memberships.activatedAt,
  suspendedAt: memberships.suspendedAt,
};

type MemberRow = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  emailVerifiedAt: Date | null;
  status: string;
  roleKey: string;
  roleName: string;
  roleId: string;
  lastLoginAt: Date | null;
  activatedAt: Date;
  suspendedAt: Date | null;
};

export function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    firstName: row.firstName,
    lastName: row.lastName,
    emailVerified: row.emailVerifiedAt !== null,
    status: row.status as Member['status'],
    role: { key: row.roleKey as RoleKey, name: row.roleName },
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    joinedAt: row.activatedAt.toISOString(),
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
  };
}

/** Escapes LIKE wildcards so a search for "100%" matches the text, not everything. */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export interface ListMembersInput {
  page: number;
  pageSize: number;
  status?: Member['status'];
  role?: RoleKey;
  search?: string;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly roles: RolesService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  // --- reads ------------------------------------------------------------------------------

  async list(auth: AuthContext, input: ListMembersInput) {
    // The company filter comes first and from the session; the client cannot widen it.
    const where = and(
      eq(memberships.organizationId, auth.organization.id),
      input.status ? eq(memberships.status, input.status) : ne(memberships.status, 'removed'),
      input.role ? eq(roles.key, input.role) : undefined,
      input.search
        ? or(
            ilike(users.email, likePattern(input.search)),
            ilike(users.displayName, likePattern(input.search)),
          )
        : undefined,
    );
    const base = this.database.db
      .select(memberColumns)
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(where);
    const [rows, totals] = await Promise.all([
      base
        // memberships.id breaks ties so pages never overlap or skip rows.
        .orderBy(asc(users.displayName), asc(memberships.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.database.db
        .select({ total: count() })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .innerJoin(roles, eq(roles.id, memberships.roleId))
        .where(where),
    ]);
    return {
      items: rows.map(toMember),
      page: input.page,
      pageSize: input.pageSize,
      total: totals[0]?.total ?? 0,
    };
  }

  async get(auth: AuthContext, memberId: string): Promise<Member> {
    const [row] = await this.database.db
      .select(memberColumns)
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(eq(memberships.id, memberId), eq(memberships.organizationId, auth.organization.id)),
      )
      .limit(1);
    // Another company's member looks exactly like one that does not exist.
    if (!row) throw new NotFoundException('Member not found.');
    return toMember(row);
  }

  // --- writes -----------------------------------------------------------------------------

  /**
   * Serialises every membership change in a company by locking its row first, then loads and
   * locks the target. One lock order everywhere means no deadlocks, and the owner count below
   * is computed with no concurrent change possible.
   */
  private async lockAndLoad(tx: Transaction, auth: AuthContext, memberId: string) {
    await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, auth.organization.id))
      .for('update');
    const [row] = await tx
      .select(memberColumns)
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(eq(memberships.id, memberId), eq(memberships.organizationId, auth.organization.id)),
      )
      .for('update', { of: memberships });
    if (!row) throw new NotFoundException('Member not found.');
    return row;
  }

  /** You may act on a member only if you hold everything their role holds. */
  private async assertOutranks(auth: AuthContext, target: MemberRow): Promise<void> {
    const role = await this.roles.byId(target.roleId);
    if (!role || !holdsAllPermissions([...auth.permissions], role.permissions)) {
      throw new ForbiddenException(
        'You cannot manage a member whose role has more access than yours.',
      );
    }
  }

  private assertNotSelf(auth: AuthContext, target: MemberRow, action: string): void {
    if (target.id === auth.membership.id) {
      throw new ForbiddenException(`You cannot ${action} yourself.`);
    }
  }

  /** The company must always keep at least one active owner. Call with the org row locked. */
  private async assertOwnerRemains(tx: Transaction, auth: AuthContext, leaving: MemberRow) {
    if (leaving.roleKey !== 'owner' || leaving.status !== 'active') return;
    const [others] = await tx
      .select({ total: count() })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.organizationId, auth.organization.id),
          eq(memberships.status, 'active'),
          eq(roles.key, 'owner'),
          ne(memberships.id, leaving.id),
        ),
      );
    if ((others?.total ?? 0) < 1) {
      throw new ConflictException(
        'The company must keep at least one active owner. Make another member an owner first.',
      );
    }
  }

  async changeRole(
    auth: AuthContext,
    memberId: string,
    roleKey: RoleKey,
    context: RequestContext,
  ): Promise<Member> {
    const newRole = await this.roles.byKey(roleKey);
    await this.database.transaction(async (tx) => {
      const target = await this.lockAndLoad(tx, auth, memberId);
      this.assertNotSelf(auth, target, 'change the role of');
      if (target.status === 'removed')
        throw new ConflictException('This member no longer has access.');
      await this.assertOutranks(auth, target);
      // Nobody may hand out more than they hold; this is what stops an administrator creating an owner.
      if (!holdsAllPermissions([...auth.permissions], newRole.permissions)) {
        throw new ForbiddenException('You cannot assign a role with more access than your own.');
      }
      if (target.roleKey === newRole.key) return;
      await this.assertOwnerRemains(tx, auth, target);

      await tx
        .update(memberships)
        .set({ roleId: newRole.id, updatedAt: sql`now()` })
        .where(eq(memberships.id, target.id));
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'membership.role_changed',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'membership',
          targetId: target.id,
          metadata: { memberUserId: target.userId, from: target.roleKey, to: newRole.key },
        },
        context,
      );
    });
    return this.get(auth, memberId);
  }

  async suspend(auth: AuthContext, memberId: string, context: RequestContext): Promise<Member> {
    await this.database.transaction(async (tx) => {
      const target = await this.lockAndLoad(tx, auth, memberId);
      this.assertNotSelf(auth, target, 'suspend');
      if (target.status !== 'active')
        throw new ConflictException('Only active members can be suspended.');
      await this.assertOutranks(auth, target);
      await this.assertOwnerRemains(tx, auth, target);

      await tx
        .update(memberships)
        .set({ status: 'suspended', suspendedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(memberships.id, target.id));
      // The old session cookies stop working at once; the user is signed out everywhere.
      const revoked = await this.sessions.revokeAllForMembership(
        tx,
        target.id,
        'membership_suspended',
      );
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'membership.suspended',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'membership',
          targetId: target.id,
          metadata: { memberUserId: target.userId, sessionsRevoked: revoked },
        },
        context,
      );
    });
    return this.get(auth, memberId);
  }

  async reactivate(auth: AuthContext, memberId: string, context: RequestContext): Promise<Member> {
    await this.database.transaction(async (tx) => {
      const target = await this.lockAndLoad(tx, auth, memberId);
      if (target.status !== 'suspended')
        throw new ConflictException('Only suspended members can be reactivated.');
      await this.assertOutranks(auth, target);

      await tx
        .update(memberships)
        .set({ status: 'active', suspendedAt: null, updatedAt: sql`now()` })
        .where(eq(memberships.id, target.id));
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'membership.reactivated',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'membership',
          targetId: target.id,
          metadata: { memberUserId: target.userId },
        },
        context,
      );
    });
    return this.get(auth, memberId);
  }

  /** Ends a person's access to the company. The row is kept so history stays attributable. */
  async remove(auth: AuthContext, memberId: string, context: RequestContext): Promise<Member> {
    await this.database.transaction(async (tx) => {
      const target = await this.lockAndLoad(tx, auth, memberId);
      this.assertNotSelf(auth, target, 'remove');
      if (target.status === 'removed')
        throw new ConflictException('This member was already removed.');
      await this.assertOutranks(auth, target);
      await this.assertOwnerRemains(tx, auth, target);

      await tx
        .update(memberships)
        .set({ status: 'removed', suspendedAt: null, removedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(memberships.id, target.id));
      const revoked = await this.sessions.revokeAllForMembership(
        tx,
        target.id,
        'membership_removed',
      );
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'membership.removed',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'membership',
          targetId: target.id,
          metadata: { memberUserId: target.userId, sessionsRevoked: revoked },
        },
        context,
      );
    });
    return this.get(auth, memberId);
  }

  async updateProfile(
    auth: AuthContext,
    memberId: string,
    changes: { firstName?: string; lastName?: string; displayName?: string },
    context: RequestContext,
  ): Promise<Member> {
    await this.database.transaction(async (tx) => {
      const target = await this.lockAndLoad(tx, auth, memberId);
      if (target.status === 'removed')
        throw new ConflictException('This member no longer has access.');
      if (target.id !== auth.membership.id) await this.assertOutranks(auth, target);

      // A person's name belongs to their account. It is editable here only while the account
      // belongs to this company alone; otherwise another company's view of them would change.
      const [elsewhere] = await tx
        .select({ total: count() })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, target.userId),
            ne(memberships.organizationId, auth.organization.id),
            inArray(memberships.status, ['active', 'suspended']),
          ),
        );
      if ((elsewhere?.total ?? 0) > 0) {
        throw new ConflictException(
          'This account belongs to more than one company and cannot be edited here.',
        );
      }

      await tx
        .update(users)
        .set({ ...changes, updatedAt: sql`now()` })
        .where(eq(users.id, target.userId));
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'member.profile_updated',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'membership',
          targetId: target.id,
          metadata: { memberUserId: target.userId, fields: Object.keys(changes) },
        },
        context,
      );
    });
    return this.get(auth, memberId);
  }
}
