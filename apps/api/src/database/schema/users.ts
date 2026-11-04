import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';

/**
 * A person's login identity. Company access is NOT stored here: it comes only from a membership.
 * One account per email address across the whole platform; one person may belong to several
 * companies through several memberships.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** As entered (trimmed), kept for display. */
    email: text('email').notNull(),
    /** Lower-cased; the column uniqueness and every lookup use. */
    emailNormalized: text('email_normalized').notNull(),
    /** Argon2id PHC string, which embeds its own salt and parameters. Never returned by the API. */
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    displayName: text('display_name').notNull(),
    /** Platform-level switch. Company-level suspension lives on the membership. */
    status: text('status').notNull().default('active'),
    /** Null until the address is proven (verification link or accepted invitation). */
    emailVerifiedAt: timestamptz('email_verified_at'),
    lastLoginAt: timestamptz('last_login_at'),
    passwordChangedAt: timestamptz('password_changed_at').notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_normalized_key').on(t.emailNormalized),
    check(
      'users_email_normalized_form',
      sql`${t.emailNormalized} = lower(btrim(${t.emailNormalized}))`,
    ),
    check('users_email_length', sql`char_length(${t.email}) between 3 and 254`),
    check('users_status_valid', sql`${t.status} in ('active', 'disabled')`),
    check(
      'users_names_not_blank',
      sql`btrim(${t.firstName}) <> '' and btrim(${t.lastName}) <> '' and btrim(${t.displayName}) <> ''`,
    ),
  ],
);
