import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { auditEntrySchema, cursorPageSchema, listAuditQuerySchema } from '@smartpack/shared';
import type { z } from 'zod';
import { Auth, RequirePermissions } from '../auth/decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { ApiEndpoint } from '../common/http/api-docs.js';
import { AuditQueryService } from './audit-query.service.js';

@ApiTags('Audit')
@Controller('organizations/current/audit-logs')
export class AuditController {
  constructor(private readonly query: AuditQueryService) {}

  @Get()
  @RequirePermissions('audit.view')
  @ApiEndpoint({
    summary: 'List audit events',
    description:
      'Newest first. Cursor pagination: pass `nextCursor` from the previous page as `cursor`. ' +
      'The audit log is append-only; there is no endpoint that edits or deletes events.',
    access: { permission: 'audit.view' },
    response: cursorPageSchema(auditEntrySchema),
    errors: [400],
  })
  list(
    @Query({ schema: listAuditQuerySchema }) query: z.infer<typeof listAuditQuerySchema>,
    @Auth() auth: AuthContext,
  ) {
    return this.query.list(auth, query);
  }
}
