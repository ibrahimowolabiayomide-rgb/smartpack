import { z } from 'zod';
import { isoTimestampSchema } from './primitives.js';

export const AUDIT_CATEGORIES = ['security', 'account', 'administration', 'system'] as const;
export const auditCategorySchema = z.enum(AUDIT_CATEGORIES);

export const auditEntrySchema = z.object({
  id: z.string(),
  occurredAt: isoTimestampSchema,
  category: auditCategorySchema,
  action: z.string(),
  outcome: z.enum(['success', 'failure']),
  actor: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  requestId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const listAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z
    .string()
    .regex(/^\d{1,18}$/)
    .optional(),
  category: auditCategorySchema.optional(),
  action: z.string().trim().min(1).max(80).optional(),
  actorId: z.uuid().optional(),
  targetType: z.string().trim().min(1).max(40).optional(),
  targetId: z.string().trim().min(1).max(64).optional(),
  from: isoTimestampSchema.optional(),
  to: isoTimestampSchema.optional(),
});
