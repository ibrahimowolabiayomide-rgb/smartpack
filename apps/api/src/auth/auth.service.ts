import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeEmail,
  type ChangePasswordInput,
  type CurrentUser,
  type EmailDeliveryStatus,
  type LoginRequest,
  type SessionSummary,
} from '@smartpack/shared';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.constants.js';
import {
  invalidCredentials,
  invalidToken,
  RateLimitedException,
} from '../common/errors/domain.exception.js';
import { ValidationFailedException } from '../common/errors/validation-failed.exception.js';
import type { RequestContext } from '../common/http/request-context.js';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { Executor } from '../database/db-types.js';
import {
  emailVerificationTokens,
  memberships,
  organizations,
  passwordResetTokens,
  users,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { checkPasswordPolicy } from '../security/password-policy.js';
import { PasswordHasher } from '../security/password-hasher.js';
import { RATE_LIMITS, RateLimiter, type RateLimitPolicy } from '../security/rate-limiter.js';
import { fingerprint, generateToken, hashToken } from '../security/tokens.js';
import { toCurrentUser, type AuthContext } from './auth-context.js';
import { formatUtcTimestamp } from '../email/templates.js';
import { emailVerificationLink, forgotPasswordPage, passwordResetLink } from './links.js';
import { SessionsService } from './sessions.service.js';

export interface SignedIn {
  current: CurrentUser;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly sessions: SessionsService,
    private readonly hasher: PasswordHasher,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  // --- sign in / out ----------------------------------------------------------------------

  async login(
    request: LoginRequest,
    context: RequestContext,
    previousToken: string | undefined,
  ): Promise<SignedIn> {
    const emailKey = normalizeEmail(request.email);
    const pairKey = `${context.ip}|${emailKey}`;
    this.assertNotBlocked([
      [RATE_LIMITS.loginFailuresPerAccountAndIp, pairKey],
      [RATE_LIMITS.loginFailuresPerAccount, emailKey],
    ]);

    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.emailNormalized, emailKey))
      .limit(1);

    if (!user) {
      // Spend the time a real check would take so response time does not reveal the account.
      await this.hasher.verifyAgainstDummy(request.password);
      return this.failLogin(null, 'unknown_account', emailKey, pairKey, context);
    }
    if (!(await this.hasher.verify(user.passwordHash, request.password))) {
      return this.failLogin(user.id, 'wrong_password', emailKey, pairKey, context);
    }
    if (user.status !== 'active') {
      return this.failLogin(user.id, 'account_disabled', emailKey, pairKey, context);
    }

    const candidates = await this.database.db
      .select({
        membershipId: memberships.id,
        organizationId: organizations.id,
        slug: organizations.slug,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.status, 'active'),
          eq(organizations.status, 'active'),
          request.organizationSlug ? eq(organizations.slug, request.organizationSlug) : undefined,
        ),
      )
      .limit(10);

    if (candidates.length === 0) {
      return this.failLogin(user.id, 'no_active_membership', emailKey, pairKey, context);
    }
    if (candidates.length > 1) {
      // The password was correct, so telling the caller what to supply leaks nothing.
      throw new ValidationFailedException([
        {
          path: 'organizationSlug',
          message: 'This account belongs to more than one company. Enter the company reference.',
        },
      ]);
    }
    const target = candidates[0];
    if (!target) throw new Error('unreachable');

    // Hashing happens before the transaction so no connection is held during CPU-heavy work.
    const upgradedHash = this.hasher.needsRehash(user.passwordHash)
      ? await this.hasher.hash(request.password)
      : null;

    const created = await this.database.transaction(async (tx) => {
      // A new random token is always issued (never reused from the request): session fixation
      // is impossible. Any session the browser already held is retired.
      if (previousToken) await this.sessions.revokeByToken(tx, previousToken, 'replaced');
      const session = await this.sessions.create(
        tx,
        { userId: user.id, membershipId: target.membershipId },
        context,
      );
      await tx
        .update(users)
        .set({
          lastLoginAt: sql`now()`,
          ...(upgradedHash ? { passwordHash: upgradedHash } : {}),
        })
        .where(eq(users.id, user.id));
      await this.sessions.purgeDeadFor(tx, user.id);
      await this.audit.record(
        tx,
        {
          category: 'security',
          action: 'auth.login.succeeded',
          organizationId: target.organizationId,
          actorUserId: user.id,
          targetType: 'session',
          targetId: session.id,
        },
        context,
      );
      return session;
    });

    this.limiter.reset(RATE_LIMITS.loginFailuresPerAccountAndIp, pairKey);
    const auth = await this.sessions.authenticate(created.token);
    if (!auth) throw new Error('A session created moments ago could not be resolved.');
    return { current: toCurrentUser(auth), token: created.token, expiresAt: created.expiresAt };
  }

  private assertNotBlocked(checks: Array<[RateLimitPolicy, string]>): void {
    for (const [policy, key] of checks) {
      const state = this.limiter.peek(policy, key);
      if (!state.allowed) throw new RateLimitedException(state.retryAfterSeconds);
    }
  }

  private async failLogin(
    userId: string | null,
    reason: string,
    emailKey: string,
    pairKey: string,
    context: RequestContext,
  ): Promise<never> {
    this.limiter.record(RATE_LIMITS.loginFailuresPerAccountAndIp, pairKey);
    this.limiter.record(RATE_LIMITS.loginFailuresPerAccount, emailKey);
    // Attribute the failure to the company when the account belongs to exactly one, so that
    // company administrators can see attacks on their own people.
    let organizationId: string | null = null;
    if (userId) {
      const own = await this.database.db
        .select({ organizationId: memberships.organizationId })
        .from(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')))
        .limit(2);
      if (own.length === 1) organizationId = own[0]?.organizationId ?? null;
    }
    await this.audit.recordStandalone(
      {
        category: 'security',
        action: 'auth.login.failed',
        outcome: 'failure',
        organizationId,
        actorUserId: userId,
        // A fingerprint lets repeated attempts on one address be correlated without storing it.
        metadata: { reason, emailFingerprint: fingerprint(emailKey) },
      },
      context,
    );
    throw invalidCredentials();
  }

  async logout(auth: AuthContext, context: RequestContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.sessions.revoke(tx, auth.sessionId, 'logout');
      await this.audit.record(
        tx,
        {
          category: 'security',
          action: 'auth.logout',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'session',
          targetId: auth.sessionId,
        },
        context,
      );
    });
  }

  async logoutAll(auth: AuthContext, context: RequestContext): Promise<number> {
    return this.database.transaction(async (tx) => {
      const count = await this.sessions.revokeAllForUser(tx, auth.user.id, 'logout_all');
      await this.audit.record(
        tx,
        {
          category: 'security',
          action: 'auth.logout_all',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          metadata: { sessionsRevoked: count },
        },
        context,
      );
      return count;
    });
  }

  // --- password ---------------------------------------------------------------------------

  async changePassword(
    auth: AuthContext,
    input: ChangePasswordInput,
    context: RequestContext,
  ): Promise<SignedIn> {
    const state = this.limiter.consume(RATE_LIMITS.passwordChangePerUser, auth.user.id);
    if (!state.allowed) throw new RateLimitedException(state.retryAfterSeconds);

    const [user] = await this.database.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, auth.user.id))
      .limit(1);
    if (!user) throw new NotFoundException();

    if (!(await this.hasher.verify(user.passwordHash, input.currentPassword))) {
      await this.audit.recordStandalone(
        {
          category: 'security',
          action: 'auth.password_change.failed',
          outcome: 'failure',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          metadata: { reason: 'wrong_current_password' },
        },
        context,
      );
      throw new ValidationFailedException([
        { path: 'currentPassword', message: 'The current password is incorrect.' },
      ]);
    }
    if (await this.hasher.verify(user.passwordHash, input.newPassword)) {
      throw new ValidationFailedException([
        { path: 'newPassword', message: 'Choose a password different from the current one.' },
      ]);
    }
    this.assertPasswordAllowed(input.newPassword, auth.user.email, [
      auth.user.firstName,
      auth.user.lastName,
    ]);
    const newHash = await this.hasher.hash(input.newPassword);

    const created = await this.database.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: newHash, passwordChangedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(users.id, auth.user.id));
      // Every session, including this one, ends; a fresh one is issued for this device only.
      const revoked = await this.sessions.revokeAllForUser(tx, auth.user.id, 'password_changed');
      const session = await this.sessions.create(
        tx,
        { userId: auth.user.id, membershipId: auth.membership.id },
        context,
      );
      await this.audit.record(
        tx,
        {
          category: 'security',
          action: 'auth.password.changed',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          metadata: { sessionsRevoked: revoked },
        },
        context,
      );
      return session;
    });

    this.notifyPasswordChanged(
      { email: auth.user.email, firstName: auth.user.firstName },
      auth.organization.id,
      'change',
      context,
    );
    const fresh = await this.sessions.authenticate(created.token);
    if (!fresh) throw new Error('A session created moments ago could not be resolved.');
    return { current: toCurrentUser(fresh), token: created.token, expiresAt: created.expiresAt };
  }

  /** Always answers the same way; whether an account exists is never revealed. */
  async requestPasswordReset(emailInput: string, context: RequestContext): Promise<void> {
    const emailKey = normalizeEmail(emailInput);
    // The per-address limit is applied by the route's @RateLimit guard; only the per-account
    // limit lives here (counting the address twice would halve the intended allowance).
    const state = this.limiter.consume(RATE_LIMITS.passwordForgotPerEmail, emailKey);
    if (!state.allowed) throw new RateLimitedException(state.retryAfterSeconds);

    const [user] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        status: users.status,
      })
      .from(users)
      .where(eq(users.emailNormalized, emailKey))
      .limit(1);

    if (!user || user.status !== 'active') {
      await this.audit.recordStandalone(
        {
          category: 'security',
          action: 'auth.password_reset.requested',
          outcome: 'failure',
          metadata: { reason: 'no_eligible_account', emailFingerprint: fingerprint(emailKey) },
        },
        context,
      );
      return;
    }

    const token = generateToken();
    await this.database.transaction(async (tx) => {
      // Only the newest link works: earlier unused ones are retired.
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: sql`now()` })
        .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + this.config.auth.passwordResetTtlMs),
      });
      await this.audit.record(
        tx,
        {
          category: 'security',
          action: 'auth.password_reset.requested',
          actorUserId: user.id,
          targetType: 'user',
          targetId: user.id,
        },
        context,
      );
    });

    // After commit and without waiting, so the response time does not depend on the mail system.
    this.email.sendInBackground({
      template: {
        name: 'password_reset',
        link: passwordResetLink(this.config.webAppUrl, token),
        expiresInMinutes: Math.round(this.config.auth.passwordResetTtlMs / 60_000),
        recipientName: user.firstName,
        recipientEmail: user.email,
      },
      to: user.email,
      requestId: context.requestId,
    });
  }

  async resetPassword(token: string, newPassword: string, context: RequestContext): Promise<void> {
    const tokenHash = hashToken(token);
    // Cheap pre-check so garbage tokens never cost a password hash.
    const [pending] = await this.database.db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(passwordResetTokens)
      .innerJoin(users, eq(users.id, passwordResetTokens.userId))
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, sql`now()`),
          eq(users.status, 'active'),
        ),
      )
      .limit(1);
    if (!pending) throw invalidToken();

    this.assertPasswordAllowed(newPassword, pending.email, [pending.firstName, pending.lastName]);
    const newHash = await this.hasher.hash(newPassword);

    await this.database.transaction(async (tx) => {
      // The conditional UPDATE is the single-use guarantee: if two requests race, only one gets a
      // row back; the other sees the token already used and fails.
      const [claimed] = await tx
        .update(passwordResetTokens)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, sql`now()`),
          ),
        )
        .returning({ userId: passwordResetTokens.userId });
      if (!claimed) throw invalidToken();

      await tx
        .update(users)
        .set({
          passwordHash: newHash,
          passwordChangedAt: sql`now()`,
          updatedAt: sql`now()`,
          // The link was delivered to this address, so using it also proves the address.
          emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
        })
        .where(eq(users.id, claimed.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: sql`now()` })
        .where(
          and(eq(passwordResetTokens.userId, claimed.userId), isNull(passwordResetTokens.usedAt)),
        );
      const revoked = await this.sessions.revokeAllForUser(tx, claimed.userId, 'password_reset');
      await this.audit.record(
        tx,
        {
          category: 'security',
          action: 'auth.password_reset.completed',
          actorUserId: claimed.userId,
          targetType: 'user',
          targetId: claimed.userId,
          metadata: { sessionsRevoked: revoked },
        },
        context,
      );
    });

    this.notifyPasswordChanged(
      { email: pending.email, firstName: pending.firstName },
      null,
      'reset',
      context,
    );
  }

  private assertPasswordAllowed(password: string, email: string, names: string[]): void {
    const result = checkPasswordPolicy(password, { email, names });
    if (!result.ok) {
      throw new ValidationFailedException([{ path: 'newPassword', message: result.message }]);
    }
  }

  private notifyPasswordChanged(
    person: { email: string; firstName: string },
    organizationId: string | null,
    via: 'change' | 'reset',
    context: RequestContext,
  ): void {
    this.email.sendInBackground({
      template: {
        name: 'password_changed',
        at: formatUtcTimestamp(new Date()),
        recipientName: person.firstName,
        recipientEmail: person.email,
        via,
        resetPageLink: forgotPasswordPage(this.config.webAppUrl),
      },
      to: person.email,
      organizationId,
      requestId: context.requestId,
    });
  }

  // --- email verification -----------------------------------------------------------------

  async resendVerification(
    auth: AuthContext,
    context: RequestContext,
  ): Promise<EmailDeliveryStatus> {
    if (auth.user.emailVerified)
      throw new ConflictException('This email address is already verified.');
    const state = this.limiter.consume(RATE_LIMITS.emailResendPerUser, auth.user.id);
    if (!state.allowed) throw new RateLimitedException(state.retryAfterSeconds);

    const token = await this.database.transaction(async (tx) => {
      const issued = await this.issueEmailVerification(tx, auth.user.id, auth.user.email);
      await this.audit.record(
        tx,
        {
          category: 'account',
          action: 'account.email.verification_requested',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
        },
        context,
      );
      return issued;
    });

    return this.email.send({
      template: {
        name: 'email_verification',
        link: emailVerificationLink(this.config.webAppUrl, token),
        expiresInHours: Math.round(this.config.auth.emailVerificationTtlMs / 3_600_000),
        recipientName: auth.user.firstName,
        recipientEmail: auth.user.email,
        organizationName: auth.organization.name,
      },
      to: auth.user.email,
      organizationId: auth.organization.id,
      requestId: context.requestId,
    });
  }

  /** Retires earlier unused links for the user and returns a new raw token. */
  private async issueEmailVerification(
    executor: Executor,
    userId: string,
    email: string,
  ): Promise<string> {
    const token = generateToken();
    await executor
      .update(emailVerificationTokens)
      .set({ usedAt: sql`now()` })
      .where(
        and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt)),
      );
    await executor.insert(emailVerificationTokens).values({
      userId,
      emailNormalized: normalizeEmail(email),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + this.config.auth.emailVerificationTtlMs),
    });
    return token;
  }

  async verifyEmail(token: string, context: RequestContext): Promise<void> {
    const state = this.limiter.consume(RATE_LIMITS.emailVerifyPerIp, context.ip);
    if (!state.allowed) throw new RateLimitedException(state.retryAfterSeconds);

    await this.database.transaction(async (tx) => {
      const [claimed] = await tx
        .update(emailVerificationTokens)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(emailVerificationTokens.tokenHash, hashToken(token)),
            isNull(emailVerificationTokens.usedAt),
            gt(emailVerificationTokens.expiresAt, sql`now()`),
          ),
        )
        .returning({
          userId: emailVerificationTokens.userId,
          emailNormalized: emailVerificationTokens.emailNormalized,
        });
      if (!claimed) throw invalidToken();

      // Matching the address means a link issued for an old address cannot verify a new one.
      const updated = await tx
        .update(users)
        .set({ emailVerifiedAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            eq(users.id, claimed.userId),
            eq(users.emailNormalized, claimed.emailNormalized),
            isNull(users.emailVerifiedAt),
          ),
        )
        .returning({ id: users.id });
      if (updated.length === 0) {
        // Already verified or the address changed: nothing to do, and the link is spent.
        return;
      }
      await this.audit.record(
        tx,
        {
          category: 'account',
          action: 'account.email.verified',
          actorUserId: claimed.userId,
          targetType: 'user',
          targetId: claimed.userId,
        },
        context,
      );
    });
  }

  // --- session management -----------------------------------------------------------------

  async listSessions(auth: AuthContext): Promise<SessionSummary[]> {
    const rows = await this.sessions.listActive(auth.user.id);
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.lastActiveAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      userAgent: row.userAgent,
      current: row.id === auth.sessionId,
    }));
  }

  /** Users may revoke only their own sessions; anyone else's id is simply "not found". */
  async revokeSession(
    auth: AuthContext,
    sessionId: string,
    context: RequestContext,
  ): Promise<void> {
    const found = await this.sessions.findOwnLive(auth.user.id, sessionId);
    if (!found) throw new NotFoundException('Session not found.');
    await this.database.transaction(async (tx) => {
      await this.sessions.revoke(tx, sessionId, 'revoked_by_user');
      await this.audit.record(
        tx,
        {
          category: 'security',
          action: 'auth.session.revoked',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'session',
          targetId: sessionId,
        },
        context,
      );
    });
  }

  async revokeOtherSessions(auth: AuthContext, context: RequestContext): Promise<number> {
    return this.database.transaction(async (tx) => {
      const count = await this.sessions.revokeAllForUser(
        tx,
        auth.user.id,
        'revoked_others',
        auth.sessionId,
      );
      await this.audit.record(
        tx,
        {
          category: 'security',
          action: 'auth.sessions.revoked_others',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          metadata: { sessionsRevoked: count },
        },
        context,
      );
      return count;
    });
  }
}
