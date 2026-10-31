import { describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  apiSuccessSchema,
  healthReportSchema,
  healthResponseSchema,
} from './index.js';
import { z } from 'zod';

const validReport = {
  status: 'ok',
  service: 'smartpack-api',
  version: '0.1.0',
  environment: 'development',
  timestamp: '2026-10-29T22:30:00.000Z',
  uptimeSeconds: 12.5,
  checks: {
    database: { status: 'up', latencyMs: 3 },
    postgis: { status: 'enabled' },
  },
} as const;

describe('health contract', () => {
  it('accepts a complete report', () => {
    expect(healthReportSchema.safeParse(validReport).success).toBe(true);
  });

  it('accepts a report for an unreachable database', () => {
    const down = {
      ...validReport,
      status: 'error',
      checks: { database: { status: 'down', latencyMs: null }, postgis: { status: 'unknown' } },
    };
    expect(healthReportSchema.safeParse(down).success).toBe(true);
  });

  it('rejects an unknown overall status', () => {
    expect(healthReportSchema.safeParse({ ...validReport, status: 'healthy' }).success).toBe(false);
  });

  it('rejects a negative latency', () => {
    const bad = {
      ...validReport,
      checks: { ...validReport.checks, database: { status: 'up', latencyMs: -1 } },
    };
    expect(healthReportSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a malformed timestamp', () => {
    expect(healthReportSchema.safeParse({ ...validReport, timestamp: 'yesterday' }).success).toBe(
      false,
    );
  });

  it('wraps the report in the success envelope', () => {
    expect(healthResponseSchema.safeParse({ data: validReport }).success).toBe(true);
    expect(healthResponseSchema.safeParse(validReport).success).toBe(false);
  });
});

describe('success envelope', () => {
  it('requires the data key', () => {
    const schema = apiSuccessSchema(z.object({ id: z.string() }));
    expect(schema.safeParse({ data: { id: 'a' } }).success).toBe(true);
    expect(schema.safeParse({ id: 'a' }).success).toBe(false);
  });
});

describe('error envelope', () => {
  it('accepts an error with validation details', () => {
    const result = apiErrorSchema.safeParse({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        statusCode: 400,
        requestId: 'req-1',
        details: [{ path: 'query.limit', message: 'Too big' }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown error code', () => {
    const result = apiErrorSchema.safeParse({
      error: { code: 'OOPS', message: 'x', statusCode: 500, requestId: 'r' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a success status code', () => {
    const result = apiErrorSchema.safeParse({
      error: { code: 'INTERNAL_ERROR', message: 'x', statusCode: 200, requestId: 'r' },
    });
    expect(result.success).toBe(false);
  });
});
