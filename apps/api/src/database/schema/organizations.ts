import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns.js';

/**
 * A company. Every operational record in later phases carries an organization_id that refers
 * here. Organizations are never deleted (RESTRICT everywhere): history must stay attributable.
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Stable, URL-safe reference. Immutable after creation. */
    slug: text('slug').notNull(),
    status: text('status').notNull().default('active'),
    timeZone: text('time_zone').notNull().default('UTC'),
    /** ISO 3166-1 alpha-2. Optional: not invented when unknown. */
    country: text('country'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('organizations_slug_key').on(t.slug),
    check('organizations_name_length', sql`char_length(btrim(${t.name})) between 2 and 120`),
    check(
      'organizations_slug_format',
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${t.slug}) between 2 and 48`,
    ),
    check('organizations_status_valid', sql`${t.status} in ('active', 'suspended')`),
    check('organizations_country_format', sql`${t.country} is null or ${t.country} ~ '^[A-Z]{2}$'`),
  ],
);
