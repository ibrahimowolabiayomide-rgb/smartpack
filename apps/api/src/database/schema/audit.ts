import { sql } from 'drizzle-orm';
import { bigint, check, index, inet, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

/**
 * Append-only record of account, security and administrative events. UPDATE, DELETE and TRUNCATE
 * are rejected by database triggers (see the audit migration), so a bug or a compromised
 * endpoint cannot rewrite history. Contains no passwords, tokens or request bodies.
 *
 * organization_id is null for events that happen before a company is known (for example a failed
 * sign-in for an unknown address).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    /** Monotonic, so it doubles as the pagination cursor. */
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    /** security | account | administration | system */
    category: text('category').notNull(),
    /** Dotted event name, e.g. auth.login.succeeded. */
    action: text('action').notNull(),
    outcome: text('outcome').notNull().default('success'),
    targetType: text('target_type'),
    targetId: text('target_id'),
    requestId: text('request_id'),
    /** Recorded for security-category events only, to investigate abuse. Not exposed by the API. */
    ipAddress: inet('ip_address'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    // The company timeline, newest first, and its keyset pagination.
    index('audit_logs_organization_id_idx').on(t.organizationId, sql`${t.id} desc`),
    // "History of this member / invitation / session".
    index('audit_logs_target_idx').on(
      t.organizationId,
      t.targetType,
      t.targetId,
      sql`${t.id} desc`,
    ),
    // Foreign key to users, and "what did this person do".
    index('audit_logs_actor_idx').on(t.actorUserId, sql`${t.id} desc`),
    check(
      'audit_logs_category_valid',
      sql`${t.category} in ('security', 'account', 'administration', 'system')`,
    ),
    check('audit_logs_outcome_valid', sql`${t.outcome} in ('success', 'failure')`),
    check(
      'audit_logs_metadata_object',
      sql`jsonb_typeof(${t.metadata}) = 'object' and pg_column_size(${t.metadata}) <= 4096`,
    ),
  ],
);

/**
 * Log of email send attempts. It records THAT a message was handed to the provider and what the
 * provider said, never the message body, so one-time links are not stored anywhere.
 */
export const emailDeliveries = pgTable(
  'email_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    template: text('template').notNull(),
    toEmail: text('to_email').notNull(),
    /** sent: the provider accepted the message. failed: it did not. */
    status: text('status').notNull(),
    provider: text('provider').notNull(),
    providerMessageId: text('provider_message_id'),
    /** Short, sanitised reason; never a stack trace or credentials. */
    error: text('error'),
    requestId: text('request_id'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('email_deliveries_organization_idx').on(t.organizationId, sql`${t.createdAt} desc`),
    check('email_deliveries_status_valid', sql`${t.status} in ('sent', 'failed')`),
    check(
      'email_deliveries_error_length',
      sql`${t.error} is null or char_length(${t.error}) <= 300`,
    ),
  ],
);
