import { Injectable, NotFoundException } from '@nestjs/common';
import type { Organization, UpdateOrganizationRequest } from '@smartpack/shared';
import { eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth-context.js';
import type { RequestContext } from '../common/http/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { organizations } from '../database/schema/index.js';

type OrganizationRow = typeof organizations.$inferSelect;

export function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as Organization['status'],
    timeZone: row.timeZone,
    country: row.country,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** The company is always the caller's own, taken from the session, never from the request. */
  async getCurrent(auth: AuthContext): Promise<Organization> {
    const [row] = await this.database.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, auth.organization.id))
      .limit(1);
    if (!row) throw new NotFoundException();
    return toOrganization(row);
  }

  async updateCurrent(
    auth: AuthContext,
    changes: UpdateOrganizationRequest,
    context: RequestContext,
  ): Promise<Organization> {
    return this.database.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, auth.organization.id))
        .for('update')
        .limit(1);
      if (!before) throw new NotFoundException();

      const set: Partial<typeof organizations.$inferInsert> = {};
      const changed: string[] = [];
      if (changes.name !== undefined && changes.name !== before.name) {
        set.name = changes.name;
        changed.push('name');
      }
      if (changes.timeZone !== undefined && changes.timeZone !== before.timeZone) {
        set.timeZone = changes.timeZone;
        changed.push('timeZone');
      }
      if (changes.country !== undefined && changes.country !== before.country) {
        set.country = changes.country;
        changed.push('country');
      }
      if (changed.length === 0) return toOrganization(before);

      const [after] = await tx
        .update(organizations)
        .set({ ...set, updatedAt: sql`now()` })
        .where(eq(organizations.id, auth.organization.id))
        .returning();
      if (!after) throw new NotFoundException();
      await this.audit.record(
        tx,
        {
          category: 'administration',
          action: 'organization.updated',
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          targetType: 'organization',
          targetId: auth.organization.id,
          // Field names only: values (such as the company name) are visible in the record itself.
          metadata: { fields: changed },
        },
        context,
      );
      return toOrganization(after);
    });
  }
}
