import { Injectable } from '@nestjs/common';
import type { AuditEntry } from '@smartpack/shared';
import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context.js';
import { DatabaseService } from '../database/database.service.js';
import { auditLogs, users } from '../database/schema/index.js';

export interface AuditQuery {
  limit: number;
  cursor?: string;
  category?: AuditEntry['category'];
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditQueryService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Keyset pagination on the monotonic id: each page costs the same however deep it is, and rows
   * written while someone is paging never shift the pages. Only this company's events are read;
   * events with no company (failed sign-ins for unknown addresses) are never shown here.
   */
  async list(auth: AuthContext, query: AuditQuery) {
    const rows = await this.database.db
      .select({
        id: auditLogs.id,
        occurredAt: auditLogs.occurredAt,
        category: auditLogs.category,
        action: auditLogs.action,
        outcome: auditLogs.outcome,
        actorId: users.id,
        actorName: users.displayName,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        requestId: auditLogs.requestId,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(
        and(
          eq(auditLogs.organizationId, auth.organization.id),
          query.cursor ? lt(auditLogs.id, Number(query.cursor)) : undefined,
          query.category ? eq(auditLogs.category, query.category) : undefined,
          query.action ? eq(auditLogs.action, query.action) : undefined,
          query.actorId ? eq(auditLogs.actorUserId, query.actorId) : undefined,
          query.targetType ? eq(auditLogs.targetType, query.targetType) : undefined,
          query.targetId ? eq(auditLogs.targetId, query.targetId) : undefined,
          query.from ? gte(auditLogs.occurredAt, sql`${query.from}::timestamptz`) : undefined,
          query.to ? lte(auditLogs.occurredAt, sql`${query.to}::timestamptz`) : undefined,
        ),
      )
      .orderBy(desc(auditLogs.id))
      .limit(query.limit + 1);

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const items: AuditEntry[] = page.map((row) => ({
      id: String(row.id),
      occurredAt: row.occurredAt.toISOString(),
      category: row.category as AuditEntry['category'],
      action: row.action,
      outcome: row.outcome as AuditEntry['outcome'],
      actor: row.actorId && row.actorName ? { id: row.actorId, displayName: row.actorName } : null,
      targetType: row.targetType,
      targetId: row.targetId,
      requestId: row.requestId,
      metadata: row.metadata as Record<string, unknown>,
    }));
    return { items, nextCursor: rows.length > query.limit && last ? String(last.id) : null };
  }
}
