import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { healthResponseSchema, type HealthReport } from '@smartpack/shared';
import type { FastifyReply } from 'fastify';
import { HealthService } from './health.service.js';
import { toOpenApiSchema } from './openapi.js';

const healthSchema = toOpenApiSchema(healthResponseSchema);

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Service and database health',
    description:
      'Runs a live query against PostgreSQL. Returns 200 when the database answers and 503 when it does not. ' +
      'The body is the same shape in both cases so monitors can parse it unconditionally.',
  })
  @ApiOkResponse({
    description: 'The API is running and the database answered.',
    schema: healthSchema,
  })
  @ApiResponse({
    status: 503,
    description: 'The API is running but the database is unreachable.',
    schema: healthSchema,
  })
  async getHealth(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthReport> {
    const report = await this.health.check();
    // Health must never be served from a cache: a stale "ok" is worse than no answer.
    void reply.header('cache-control', 'no-store');
    if (report.status === 'error') void reply.status(503);
    return report;
  }
}
