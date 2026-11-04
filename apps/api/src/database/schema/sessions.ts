import { sql } from 'drizzle-orm';
import { check, index, inet, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, timestamptz } from './columns.js';
import { memberships } from './access.js';
import { users } from './users.js';

/**
 * Server-side sessions. The browser holds a random token; only its SHA-256 hash is stored, so a
 * database leak does not yield usable sessions. The company context is fixed at sign-in by the
 * membership, never taken from a request.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'restrict' }),
    /** Hex SHA-256 of the session token. */
    tokenHash: text('token_hash').notNull(),
    createdAt: createdAt(),
    lastActiveAt: timestamptz('last_active_at').notNull().defaultNow(),
    /** Absolute lifetime; the idle limit is checked against last_active_at (configurable). */
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    revokedReason: text('revoked_reason'),
    /** Truncated user agent and client address, shown to the owner of the session so they can
     *  recognise a device they do not know. Removed with the session row. */
    userAgent: text('user_agent'),
    ipAddress: inet('ip_address'),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
    // "My active sessions", "revoke all for this user": only live rows are ever searched.
    index('sessions_user_active_idx')
      .on(t.userId)
      .where(sql`${t.revokedAt} is null`),
    index('sessions_membership_active_idx')
      .on(t.membershipId)
      .where(sql`${t.revokedAt} is null`),
    check('sessions_token_hash_form', sql`char_length(${t.tokenHash}) = 64`),
    check(
      'sessions_revoked_reason_valid',
      sql`(${t.revokedAt} is null) = (${t.revokedReason} is null)`,
    ),
  ],
);
