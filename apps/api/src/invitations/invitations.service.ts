import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  holdsAllPermissions,
  normalizeEmail,
  type AcceptInvitationRequest,
  type EmailDeliveryStatus,
  type Invitation,
  type RoleKey,
} from '@smartpack/shared';
import { and, count, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth-context.js';
import { invitationLink } from '../auth/links.js';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.constants.js';
import {
  invalidCredentials,
  invalidToken,
  RateLimitedException,
} from '../common/errors/domain.exception.js';
import { ValidationFailedException } from '../common/errors/validation-failed.exception.js';
import type { RequestContext } from '../common/http/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { isUniqueViolation } from '../database/pg-errors.js';
import { invitations, memberships, organizations, roles, users } from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { RolesService, type RoleRecord } from '../roles/roles.service.js';
import { checkPasswordPolicy } from '../security/password-policy.js';
import { PasswordHasher } from '../security/password-hasher.js';
import { RATE_LIMITS, RateLimiter } from '../security/rate-limiter.js';
import { fingerprint, generateToken, hashToken } from '../security/tokens.js';

const inviter = users;

type InvitationRow = {
  id: string;
  email: string;
  roleKey: string;
  roleName: string;
  status: string;
  invitedById: string;
  invitedByName: string;
  expiresAt: Date;
  createdAt: Date;
  lastSentAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

const invitationColumns = {
  id: invitations.id,
  email: invitations.email,
  roleKey: roles.key,
  roleName: roles.name,
  status: invitations.status,
  invitedById: inviter.id,
  invitedByName: inviter.displayName,
  expiresAt: invitations.expiresAt,
  createdAt: invitations.createdAt,
  lastSentAt: invitations.lastSentAt,
  acceptedAt: invitations.acceptedAt,
  revokedAt: invitations.revokedAt,
};

export function toInvitation(row: InvitationRow, now = new Date()): Invitation {
  // "Expired" is not stored: it is a pending invitation whose time has passed.
  const status =
    row.status === 'pending' && row.expiresAt <= now
      ? 'expired'
      : (row.status as Invitation['status']);
  return {
    id: row.id,
    email: row.email,
    role: { key: row.roleKey as RoleKey, name: row.roleName },
    status,
    invitedBy: { id: row.invitedById, displayName: row.invitedByName },
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    lastSentAt: row.lastSentAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly roles: RolesService,
    private readonly hasher: PasswordHasher,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  // --- administration ---------------------------------------------------------------------

  async list(
    auth: AuthContext,
    input: { page: number; pageSize: number; status?: Invitation['status'] },
  ) {
    const statusFilter = (() => {
      switch (input.status) {
        case 'pending':
          return and(eq(invitations.status, 'pending'), gt(invitations.expiresAt, sql`now()`));
        case 'expired':
          return and(eq(invitations.status, 'pending'), lte(invitations.expiresAt, sql`now()`));
        case 'accepted':
        case 'revoked':
          return eq(invitations.status, input.status);
        default:
          return undefined;
      }
    })();
    const where = and(eq(invitations.organizationId, auth.organization.id), statusFilter);
    const [rows, totals] = await Promise.all([
      this.database.db
        .select(invitationColumns)
        .from(invitations)
        .innerJoin(roles, eq(roles.id, invitations.roleId))
        .innerJoin(inviter, eq(inviter.id, invitations.invitedByUserId))
        .where(where)
        .orderBy(desc(invitations.createdAt), desc(invitations.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.database.db.select({ total: count() }).from(invitations).where(where),
    ]);
    const now = new Date();
    return {
      items: rows.map((row) => toInvitation(row, now)),
      page: input.page,
      pageSize: input.pageSize,
      total: totals[0]?.total ?? 0,
    };
  }

  private async getOne(auth: AuthContext, id: string): Promise<Invitation> {
    const [row] = await this.database.db
      .select(invitationColumns)
      .from(invitations)
      .innerJoin(roles, eq(roles.id, invitations.roleId))
      .innerJoin(inviter, eq(inviter.id, invitations.invitedByUserId))
      .where(and(eq(invitations.id, id), eq(invitations.organizationId, auth.organization.id)))
      .limit(1);
    if (!row) throw new NotFoundException('Invitation not found.');
    return toInvitation(row);
  }

  private assertCanGrant(auth: AuthContext, role: RoleRecord): void {
    if (!holdsAllPermissions([...auth.permissions], role.permissions)) {
      throw new ForbiddenException(
        'You cannot invite someone to a role with more access than your own.',
      );
    }
  }

  private assertSendAllowed(auth: AuthContext): void {
    const state = this.limiter.consume(RATE_LIMITS.invitationSendPerUser, auth.user.id);
    if (!state.allowed) throw new RateLimitedException(state.retryAfterSeconds);
  }

  async create(
    auth: AuthContext,
    input: { email: string; role: RoleKey },
    context: RequestContext,
  ): Promise<{ invitation: Invitation; emailDelivery: EmailDeliveryStatus }> {
    this.assertSendAllowed(auth);
    const role = await this.roles.byKey(input.role);
    this.assertCanGrant(auth, role);
    const emailKey = normalizeEmail(input.email);
    const token = generateToken();

    const invitationId = await this.database.transaction(async (tx) => {
      const [alreadyMember] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            eq(memberships.organizationId, auth.organization.id),
            eq(users.emailNormalized, emailKey),
            inArray(memberships.status, ['active', 'suspended']),
          ),
        )
        .limit(1);
      if (alreadyMember) {
        throw new ConflictException('This person is already a member of the company.');
      }

      // A lapsed invitation must not block a new one for the same address.
      await tx
        .update(invitations)
        .set({ status: 'revoked', revokedAt: sql`now()`, revokedByUserId: auth.user.id })
        .where(
          and(
            eq(invitations.organizationId, auth.organization.id),
            eq(invitations.emailNormalized, emailKey),
            eq(invitations.status, 'pending'),
            lte(invitations.expiresAt, sql`now()`),
          ),
        );

      let id: string;
      try {
        const [row] = await tx
          .insert(invitations)
          .values({
            organizationId: auth.organization.id,
            email: input.email,
            emailNormalized: emailKey,
            roleId: role.id,
            tokenHash: hashToken(token),
            invitedByUserId: auth.user.id,
            expiresAt: new Date(Date.now() + this.config.auth.invitationTtlMs),
          })
          .returning({ id: invitations.id });
        if (!row) throw new Error('Invitation insert returned no row.');
        id = row.id;
      } catch (error) {
        if (isUniqueViolation(error, 'invitations_one_pending_per_email_key')) {
          throw new ConflictException(
            'A pending invitation for this address already exists. Resend or revoke it.',
          );
        }
        throw error;
      }
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'invitation.created',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'invitation',
          targetId: id,
          metadata: { email: emailKey, role: role.key },
        },
        context,
      );
      return id;
    });

    const emailDelivery = await this.sendInvitation(auth, input.email, role, token, context, false);
    return { invitation: await this.getOne(auth, invitationId), emailDelivery };
  }

  /** Runs after the transaction has committed, so a slow mail server never holds a connection. */
  private sendInvitation(
    auth: AuthContext,
    to: string,
    role: RoleRecord,
    token: string,
    context: RequestContext,
    resend: boolean,
  ): Promise<EmailDeliveryStatus> {
    return this.email.send({
      template: {
        name: 'invitation',
        organizationName: auth.organization.name,
        inviterName: auth.user.displayName,
        roleName: role.name,
        roleKey: role.key,
        recipientEmail: to,
        resend,
        link: invitationLink(this.config.webAppUrl, token),
        expiresInHours: Math.round(this.config.auth.invitationTtlMs / 3_600_000),
      },
      to,
      organizationId: auth.organization.id,
      requestId: context.requestId,
    });
  }

  /** Issues a NEW link (the old one stops working) and extends the deadline. */
  async resend(
    auth: AuthContext,
    id: string,
    context: RequestContext,
  ): Promise<{ invitation: Invitation; emailDelivery: EmailDeliveryStatus }> {
    this.assertSendAllowed(auth);
    const token = generateToken();
    const { email, role } = await this.database.transaction(async (tx) => {
      const [current] = await tx
        .select({
          email: invitations.email,
          status: invitations.status,
          roleId: invitations.roleId,
        })
        .from(invitations)
        .where(and(eq(invitations.id, id), eq(invitations.organizationId, auth.organization.id)))
        .for('update')
        .limit(1);
      if (!current) throw new NotFoundException('Invitation not found.');
      if (current.status !== 'pending') {
        throw new ConflictException('Only pending invitations can be resent.');
      }
      const role = await this.roles.byId(current.roleId);
      if (!role) throw new NotFoundException();
      this.assertCanGrant(auth, role);

      await tx
        .update(invitations)
        .set({
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + this.config.auth.invitationTtlMs),
          lastSentAt: sql`now()`,
        })
        .where(eq(invitations.id, id));
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'invitation.resent',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'invitation',
          targetId: id,
        },
        context,
      );
      return { email: current.email, role };
    });
    const emailDelivery = await this.sendInvitation(auth, email, role, token, context, true);
    return { invitation: await this.getOne(auth, id), emailDelivery };
  }

  async revoke(auth: AuthContext, id: string, context: RequestContext): Promise<Invitation> {
    await this.database.transaction(async (tx) => {
      const [revoked] = await tx
        .update(invitations)
        .set({ status: 'revoked', revokedAt: sql`now()`, revokedByUserId: auth.user.id })
        .where(
          and(
            eq(invitations.id, id),
            eq(invitations.organizationId, auth.organization.id),
            eq(invitations.status, 'pending'),
          ),
        )
        .returning({ id: invitations.id });
      if (!revoked) {
        const [exists] = await tx
          .select({ id: invitations.id })
          .from(invitations)
          .where(and(eq(invitations.id, id), eq(invitations.organizationId, auth.organization.id)))
          .limit(1);
        if (!exists) throw new NotFoundException('Invitation not found.');
        throw new ConflictException('Only pending invitations can be revoked.');
      }
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'invitation.revoked',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'invitation',
          targetId: id,
        },
        context,
      );
    });
    return this.getOne(auth, id);
  }

  // --- public: preview and accept ---------------------------------------------------------

  private async findOpenByToken(token: string) {
    const [row] = await this.database.db
      .select({
        id: invitations.id,
        email: invitations.email,
        emailNormalized: invitations.emailNormalized,
        organizationId: invitations.organizationId,
        organizationName: organizations.name,
        roleId: invitations.roleId,
        roleName: roles.name,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
      .innerJoin(roles, eq(roles.id, invitations.roleId))
      .where(
        and(
          eq(invitations.tokenHash, hashToken(token)),
          eq(invitations.status, 'pending'),
          gt(invitations.expiresAt, sql`now()`),
          eq(organizations.status, 'active'),
        ),
      )
      .limit(1);
    if (!row) throw invalidToken();
    return row;
  }

  private assertTokenAttemptAllowed(context: RequestContext): void {
    const state = this.limiter.consume(RATE_LIMITS.invitationTokenPerIp, context.ip);
    if (!state.allowed) throw new RateLimitedException(state.retryAfterSeconds);
  }

  async preview(token: string, context: RequestContext) {
    this.assertTokenAttemptAllowed(context);
    const open = await this.findOpenByToken(token);
    const [existing] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.emailNormalized, open.emailNormalized))
      .limit(1);
    return {
      organizationName: open.organizationName,
      email: open.email,
      roleName: open.roleName,
      accountExists: existing !== undefined,
      expiresAt: open.expiresAt.toISOString(),
    };
  }

  async accept(request: AcceptInvitationRequest, context: RequestContext) {
    this.assertTokenAttemptAllowed(context);
    const open = await this.findOpenByToken(request.token);
    const [existing] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.emailNormalized, open.emailNormalized))
      .limit(1);
    if (request.accountExists !== (existing !== undefined)) {
      throw new ConflictException('The account state changed. Reload the page and try again.');
    }

    const failureKey = `${context.ip}|${open.emailNormalized}`;
    let passwordHash: string | undefined;
    if (existing && request.accountExists) {
      // Accepting for an existing account requires proving it is yours: its current password.
      const blocked = this.limiter.peek(
        RATE_LIMITS.invitationAcceptFailuresPerEmailAndIp,
        failureKey,
      );
      if (!blocked.allowed) throw new RateLimitedException(blocked.retryAfterSeconds);
      const valid =
        (await this.hasher.verify(existing.passwordHash, request.password)) &&
        existing.status === 'active';
      if (!valid) {
        this.limiter.record(RATE_LIMITS.invitationAcceptFailuresPerEmailAndIp, failureKey);
        await this.audit.recordStandalone(
          {
            category: 'security',
            action: 'invitation.accept.failed',
            outcome: 'failure',
            organizationId: open.organizationId,
            actorUserId: existing.id,
            targetType: 'invitation',
            targetId: open.id,
            metadata: {
              reason: 'wrong_password',
              emailFingerprint: fingerprint(open.emailNormalized),
            },
          },
          context,
        );
        throw invalidCredentials();
      }
    } else if (!request.accountExists) {
      const policy = checkPasswordPolicy(request.password, {
        email: open.email,
        names: [request.firstName, request.lastName],
      });
      if (!policy.ok) {
        throw new ValidationFailedException([{ path: 'password', message: policy.message }]);
      }
      passwordHash = await this.hasher.hash(request.password);
    }

    const result = await this.database.transaction(async (tx) => {
      // Claiming the invitation is the single-use guarantee. A concurrent second acceptance
      // waits on this row, then finds it no longer pending and gets nothing back.
      const [claimed] = await tx
        .update(invitations)
        .set({ status: 'accepted', acceptedAt: sql`now()` })
        .where(
          and(
            eq(invitations.id, open.id),
            eq(invitations.status, 'pending'),
            gt(invitations.expiresAt, sql`now()`),
          ),
        )
        .returning({ id: invitations.id });
      if (!claimed) throw invalidToken();

      let userId: string;
      if (existing) {
        userId = existing.id;
        await tx
          .update(users)
          .set({
            emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
            updatedAt: sql`now()`,
          })
          .where(eq(users.id, userId));
      } else if (request.accountExists === false && passwordHash !== undefined) {
        try {
          const [created] = await tx
            .insert(users)
            .values({
              email: open.email,
              emailNormalized: open.emailNormalized,
              passwordHash,
              firstName: request.firstName,
              lastName: request.lastName,
              displayName: `${request.firstName} ${request.lastName}`.slice(0, 160),
              // The invitation link reached this mailbox, which proves control of the address.
              emailVerifiedAt: new Date(),
            })
            .returning({ id: users.id });
          if (!created) throw new Error('User insert returned no row.');
          userId = created.id;
        } catch (error) {
          if (isUniqueViolation(error, 'users_email_normalized_key')) {
            throw new ConflictException(
              'The account state changed. Reload the page and try again.',
            );
          }
          throw error;
        }
      } else {
        throw new Error('Inconsistent invitation acceptance state.');
      }

      await tx
        .update(invitations)
        .set({ acceptedByUserId: userId })
        .where(eq(invitations.id, open.id));

      const [membership] = await tx
        .select({ id: memberships.id, status: memberships.status })
        .from(memberships)
        .where(
          and(eq(memberships.organizationId, open.organizationId), eq(memberships.userId, userId)),
        )
        .for('update')
        .limit(1);

      let membershipId: string;
      let action: 'membership.created' | 'membership.reactivated';
      if (!membership) {
        const [created] = await tx
          .insert(memberships)
          .values({ organizationId: open.organizationId, userId, roleId: open.roleId })
          .returning({ id: memberships.id });
        if (!created) throw new Error('Membership insert returned no row.');
        membershipId = created.id;
        action = 'membership.created';
      } else if (membership.status === 'removed') {
        await tx
          .update(memberships)
          .set({
            status: 'active',
            roleId: open.roleId,
            removedAt: null,
            suspendedAt: null,
            activatedAt: sql`now()`,
            updatedAt: sql`now()`,
          })
          .where(eq(memberships.id, membership.id));
        membershipId = membership.id;
        action = 'membership.reactivated';
      } else {
        throw new ConflictException(
          membership.status === 'suspended'
            ? 'Your access is suspended. Ask a company administrator to reactivate it.'
            : 'You are already a member of this company.',
        );
      }

      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'invitation.accepted',
          organizationId: open.organizationId,
          actorUserId: userId,
          targetType: 'invitation',
          targetId: open.id,
        },
        context,
      );
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action,
          organizationId: open.organizationId,
          actorUserId: userId,
          targetType: 'membership',
          targetId: membershipId,
        },
        context,
      );
      return { organizationName: open.organizationName, email: open.email };
    });

    this.limiter.reset(RATE_LIMITS.invitationAcceptFailuresPerEmailAndIp, failureKey);
    return result;
  }
}
