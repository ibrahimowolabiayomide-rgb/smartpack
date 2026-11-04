import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

/** Reference data seeded by migration; the key is the stable identifier used in code. */
export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  category: text('category').notNull(),
  description: text('description').notNull(),
});

/**
 * Built-in roles. There is no organization_id: custom per-company roles are not part of Phase 3.
 * Adding them later is an additive migration (a nullable organization_id).
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    rank: integer('rank').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('roles_key_key').on(t.key)],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'restrict' }),
  },
  (t) => [
    primaryKey({ name: 'role_permissions_pkey', columns: [t.roleId, t.permissionKey] }),
    // The primary key serves lookups by role; this serves "which roles carry permission X".
    index('role_permissions_permission_idx').on(t.permissionKey),
  ],
);

/**
 * The only thing that grants a user access to a company. Removal is a status change, not a
 * delete, so later custody and audit records keep pointing at a real row.
 */
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('active'),
    activatedAt: timestamptz('activated_at').notNull().defaultNow(),
    suspendedAt: timestamptz('suspended_at'),
    removedAt: timestamptz('removed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Also serves "this company's membership for this user".
    uniqueIndex('memberships_organization_user_key').on(t.organizationId, t.userId),
    // Member lists filter by company and status.
    index('memberships_organization_status_idx').on(t.organizationId, t.status),
    // "Which companies does this user belong to" (login) and the user FK.
    index('memberships_user_idx').on(t.userId),
    // Foreign key to roles; also counts owners per company.
    index('memberships_role_idx').on(t.roleId),
    check('memberships_status_valid', sql`${t.status} in ('active', 'suspended', 'removed')`),
    check(
      'memberships_status_timestamps',
      sql`(${t.status} = 'suspended') = (${t.suspendedAt} is not null) and (${t.status} = 'removed') = (${t.removedAt} is not null)`,
    ),
  ],
);
