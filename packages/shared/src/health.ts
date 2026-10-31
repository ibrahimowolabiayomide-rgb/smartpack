import { z } from 'zod';
import { apiSuccessSchema } from './envelope.js';

/**
 * Overall status:
 * - `ok`: every required dependency is healthy.
 * - `degraded`: the service can answer requests but a platform requirement is not met
 *   (PostGIS missing). HTTP 200.
 * - `error`: the database is unreachable. HTTP 503.
 */
export const healthStatusSchema = z.enum(['ok', 'degraded', 'error']);

export const databaseCheckSchema = z.object({
  status: z.enum(['up', 'down']),
  /** Round-trip time of the probe query. `null` when the database could not be reached. */
  latencyMs: z.number().nonnegative().nullable(),
});

export const postgisCheckSchema = z.object({
  /** `unknown` means it could not be determined because the database is down. */
  status: z.enum(['enabled', 'missing', 'unknown']),
});

export const healthReportSchema = z.object({
  status: healthStatusSchema,
  service: z.literal('smartpack-api'),
  version: z.string().min(1),
  environment: z.enum(['development', 'test', 'production']),
  timestamp: z.iso.datetime(),
  uptimeSeconds: z.number().nonnegative(),
  checks: z.object({
    database: databaseCheckSchema,
    postgis: postgisCheckSchema,
  }),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthReport = z.infer<typeof healthReportSchema>;

/** Response body of `GET /api/v1/health` (returned with HTTP 200 or 503). */
export const healthResponseSchema = apiSuccessSchema(healthReportSchema);
export type HealthResponse = z.infer<typeof healthResponseSchema>;
