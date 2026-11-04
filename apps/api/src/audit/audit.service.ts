import { Injectable, Logger } from '@nestjs/common';
import type { RequestContext } from '../common/http/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import type { Executor } from '../database/db-types.js';
import { summariseDatabaseError } from '../database/error-summary.js';
import { auditLogs } from '../database/schema/index.js';

export type AuditCategory = 'security' | 'account' | 'administration' | 'system';

export interface AuditEvent {
  category: AuditCategory;
  /** Dotted event name, e.g. `membership.role_changed`. */
  action: string;
  outcome?: 'success' | 'failure';
  organizationId?: string | null;
  actorUserId?: string | null;
  targetType?: string;
  targetId?: string;
  /** Non-sensitive facts only. Never passwords, tokens, hashes or request bodies. */
  metadata?: Record<string, string | number | boolean | null | string[]>;
}

/** Metadata keys that must never be written, enforced as a backstop against a careless caller. */
const FORBIDDEN_KEYS = /pass(word)?|token|secret|hash|authorization|cookie/i;

function assertSafeMetadata(metadata: AuditEvent['metadata']): void {
  for (const key of Object.keys(metadata ?? {})) {
    if (FORBIDDEN_KEYS.test(key)) {
      throw new Error(`Audit metadata key "${key}" is not allowed.`);
    }
  }
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Writes an event using the caller's executor. Inside a transaction this makes the audit row
   * commit or roll back together with the change it describes, so an action cannot happen
   * without a record.
   */
  async record(executor: Executor, event: AuditEvent, context: RequestContext): Promise<void> {
    assertSafeMetadata(event.metadata);
    await executor.insert(auditLogs).values({
      category: event.category,
      action: event.action,
      outcome: event.outcome ?? 'success',
      organizationId: event.organizationId ?? null,
      actorUserId: event.actorUserId ?? null,
      targetType: event.targetType ?? null,
      targetId: event.targetId ?? null,
      requestId: context.requestId,
      // Client addresses are kept for security events only (abuse investigation).
      ipAddress: event.category === 'security' ? context.ip : null,
      metadata: event.metadata ?? {},
    });
  }

  /**
   * For events with no transaction to join (failed sign-ins). A failure to write the record must
   * not turn a rejected sign-in into a server error, so it is logged and swallowed.
   */
  async recordStandalone(event: AuditEvent, context: RequestContext): Promise<void> {
    try {
      await this.record(this.database.db, event, context);
    } catch (error) {
      this.logger.error(
        `Failed to write audit event ${event.action}: ${summariseDatabaseError(error)} (requestId ${context.requestId})`,
      );
    }
  }
}
