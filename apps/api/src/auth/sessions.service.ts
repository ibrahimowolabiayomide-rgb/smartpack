import { Inject, Injectable } from '@nestjs/common';
import type { RoleKey } from '@smartpack/shared';
import { and, desc, eq, gt, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.constants.js';
import type { RequestContext } from '../common/http/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import type { Executor } from '../database/db-types.js';
import {
  memberships,
  organizations,
  rolePermissions,
  roles,
  sessions,
  users,
} from '../database/schema/index.js';
import { generateToken, hashToken } from '../security/tokens.js';
import type { AuthContext } from './auth-context.js';

export type RevokeReason =
  | 'logout'
  | 'logout_all'
  | 'revoked_by_user'
  | 'revoked_others'
  | 'password_changed'
  | 'password_reset'
  | 'membership_suspended'
  | 'membership_removed'
  | 'replaced';

/** `last_active_at` is written at most this often, so reads do not become writes. */
const TOUCH_INTERVAL_MS = 60_000;
const ROLE_CACHE_TTL_MS = 60_000;
const RETAIN_DEAD_SESSIONS = "interval '30 days'";

@Injectable()
export class SessionsService {
  private readonly rolePermissionCache = new Map<string, { at: number; permissions: string[] }>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
  ) {}

  /** Creates a session with a fresh random token. The raw token is returned once, never stored. */
  async create(
    executor: Executor,
    input: { userId: string; membershipId: string },
    context: RequestContext,
  ): Promise<{ token: string; id: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + this.config.auth.sessionAbsoluteMs);
    const [row] = await executor
      .insert(sessions)
      .values({
        userId: input.userId,
        membershipId: input.membershipId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: context.userAgent,
        ipAddress: context.ip,
      })
      .returning({ id: sessions.id });
    if (!row) throw new Error('Session insert returned no row.');
    return { token, id: row.id, expiresAt };
  }

  /**
   * Resolves a cookie value to the caller's identity in ONE query. Every condition is checked in
   * the database on every request, so a revoked session, an expired or idle one, a suspended
   * membership, a disabled account and a suspended company all stop working immediately.
   */
  async authenticate(token: string): Promise<AuthContext | null> {
    const idleSeconds = Math.floor(this.config.auth.sessionIdleMs / 1000);
    const [row] = await this.database.db
      .select({
        sessionId: sessions.id,
        sessionCreatedAt: sessions.createdAt,
        sessionExpiresAt: sessions.expiresAt,
        lastActiveAt: sessions.lastActiveAt,
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
        emailVerifiedAt: users.emailVerifiedAt,
        userStatus: users.status,
        membershipId: memberships.id,
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        organizationTimeZone: organizations.timeZone,
        roleId: roles.id,
        roleKey: roles.key,
        roleName: roles.name,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(memberships, eq(memberships.id, sessions.membershipId))
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, sql`now()`),
          gt(sessions.lastActiveAt, sql`now() - make_interval(secs => ${idleSeconds})`),
          eq(users.status, 'active'),
          eq(memberships.status, 'active'),
          eq(organizations.status, 'active'),
        ),
      )
      .limit(1);
    if (!row) return null;

    if (Date.now() - row.lastActiveAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.database.db
        .update(sessions)
        .set({ lastActiveAt: sql`now()` })
        .where(eq(sessions.id, row.sessionId));
    }

    const permissions = await this.permissionsForRole(row.roleId);
    return {
      sessionId: row.sessionId,
      sessionCreatedAt: row.sessionCreatedAt,
      sessionExpiresAt: row.sessionExpiresAt,
      user: {
        id: row.userId,
        email: row.email,
        displayName: row.displayName,
        firstName: row.firstName,
        lastName: row.lastName,
        emailVerified: row.emailVerifiedAt !== null,
        status: 'active',
      },
      organization: {
        id: row.organizationId,
        name: row.organizationName,
        slug: row.organizationSlug,
        timeZone: row.organizationTimeZone,
      },
      membership: { id: row.membershipId, roleKey: row.roleKey as RoleKey, roleName: row.roleName },
      permissions: new Set(permissions),
    };
  }

  /** Role grants only change through migrations, so a short cache is safe and saves a query. */
  private async permissionsForRole(roleId: string): Promise<string[]> {
    const cached = this.rolePermissionCache.get(roleId);
    if (cached && Date.now() - cached.at < ROLE_CACHE_TTL_MS) return cached.permissions;
    const rows = await this.database.db
      .select({ key: rolePermissions.permissionKey })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    const permissions = rows.map((row) => row.key);
    this.rolePermissionCache.set(roleId, { at: Date.now(), permissions });
    return permissions;
  }

  /** Retires whatever session a cookie pointed at (used when a new sign-in replaces it). */
  async revokeByToken(executor: Executor, token: string, reason: RevokeReason): Promise<void> {
    await executor
      .update(sessions)
      .set({ revokedAt: sql`now()`, revokedReason: reason })
      .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)));
  }

  /** Revokes one session. Returns false if it was already revoked (a conditional update). */
  async revoke(executor: Executor, sessionId: string, reason: RevokeReason): Promise<boolean> {
    const rows = await executor
      .update(sessions)
      .set({ revokedAt: sql`now()`, revokedReason: reason })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  async revokeAllForUser(
    executor: Executor,
    userId: string,
    reason: RevokeReason,
    exceptSessionId?: string,
  ): Promise<number> {
    const rows = await executor
      .update(sessions)
      .set({ revokedAt: sql`now()`, revokedReason: reason })
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
        ),
      )
      .returning({ id: sessions.id });
    return rows.length;
  }

  async revokeAllForMembership(
    executor: Executor,
    membershipId: string,
    reason: RevokeReason,
  ): Promise<number> {
    const rows = await executor
      .update(sessions)
      .set({ revokedAt: sql`now()`, revokedReason: reason })
      .where(and(eq(sessions.membershipId, membershipId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length;
  }

  /** Active sessions of one user, newest activity first. */
  async listActive(userId: string) {
    const idleSeconds = Math.floor(this.config.auth.sessionIdleMs / 1000);
    return this.database.db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        lastActiveAt: sessions.lastActiveAt,
        expiresAt: sessions.expiresAt,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, sql`now()`),
          gt(sessions.lastActiveAt, sql`now() - make_interval(secs => ${idleSeconds})`),
        ),
      )
      .orderBy(desc(sessions.lastActiveAt))
      .limit(100);
  }

  /** Looks up a session by id, only if it belongs to the user and is still revocable. */
  async findOwnLive(userId: string, sessionId: string): Promise<{ id: string } | undefined> {
    const [row] = await this.database.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)),
      )
      .limit(1);
    return row;
  }

  /**
   * Data-minimisation: dead sessions (expired or revoked more than 30 days ago) carry an IP
   * address and user agent, so they are deleted opportunistically at the user's next sign-in
   * rather than by a background job.
   */
  async purgeDeadFor(executor: Executor, userId: string): Promise<void> {
    await executor
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          or(
            lt(sessions.expiresAt, sql.raw(`now() - ${RETAIN_DEAD_SESSIONS}`)),
            lt(sessions.revokedAt, sql.raw(`now() - ${RETAIN_DEAD_SESSIONS}`)),
          ),
        ),
      );
  }

  // --- cookie -----------------------------------------------------------------------------

  setCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    void reply.setCookie(this.config.auth.cookieName, token, {
      httpOnly: true,
      secure: this.config.auth.cookieSecure,
      // Lax: sent on top-level navigations (links from email) but never on cross-site POSTs.
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  }

  clearCookie(reply: FastifyReply): void {
    void reply.clearCookie(this.config.auth.cookieName, {
      httpOnly: true,
      secure: this.config.auth.cookieSecure,
      sameSite: 'lax',
      path: '/',
    });
  }

  tokenFrom(cookies: Record<string, string | undefined> | undefined): string | undefined {
    const value = cookies?.[this.config.auth.cookieName];
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
  }
}
