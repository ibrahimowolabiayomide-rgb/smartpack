import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, timestamptz } from './columns.js';
import { roles } from './access.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

/** Invitations to join a company. The raw token exists only in the email that carries it. */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    email: text('email').notNull(),
    emailNormalized: text('email_normalized').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** pending | accepted | revoked. "Expired" is derived from expires_at when read. */
    status: text('status').notNull().default('pending'),
    expiresAt: timestamptz('expires_at').notNull(),
    lastSentAt: timestamptz('last_sent_at').notNull().defaultNow(),
    acceptedAt: timestamptz('accepted_at'),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    revokedAt: timestamptz('revoked_at'),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('invitations_token_hash_key').on(t.tokenHash),
    // At most one open invitation per address and company; also the duplicate-invite guard.
    uniqueIndex('invitations_one_pending_per_email_key')
      .on(t.organizationId, t.emailNormalized)
      .where(sql`${t.status} = 'pending'`),
    // Invitation list per company, newest first, filtered by status.
    index('invitations_organization_status_idx').on(t.organizationId, t.status, t.createdAt),
    index('invitations_role_idx').on(t.roleId),
    index('invitations_invited_by_idx').on(t.invitedByUserId),
    check('invitations_status_valid', sql`${t.status} in ('pending', 'accepted', 'revoked')`),
    check('invitations_token_hash_form', sql`char_length(${t.tokenHash}) = 64`),
    check(
      'invitations_state_consistent',
      sql`(${t.status} = 'accepted') = (${t.acceptedAt} is not null) and (${t.status} = 'revoked') = (${t.revokedAt} is not null)`,
    ),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('password_reset_tokens_token_hash_key').on(t.tokenHash),
    // Issuing a new token retires the user's earlier unused ones.
    index('password_reset_tokens_user_unused_idx')
      .on(t.userId)
      .where(sql`${t.usedAt} is null`),
    check('password_reset_tokens_hash_form', sql`char_length(${t.tokenHash}) = 64`),
  ],
);

/** The address being verified is stored so changing the email later cannot reuse an old link. */
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    emailNormalized: text('email_normalized').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('email_verification_tokens_token_hash_key').on(t.tokenHash),
    index('email_verification_tokens_user_unused_idx')
      .on(t.userId)
      .where(sql`${t.usedAt} is null`),
    check('email_verification_tokens_hash_form', sql`char_length(${t.tokenHash}) = 64`),
  ],
);
