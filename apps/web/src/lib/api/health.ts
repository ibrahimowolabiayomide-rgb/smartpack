import { healthReportSchema, type HealthReport } from '@smartpack/shared';
import { apiGet, type ApiFailure, type ApiGetOptions } from './client';

export { resolveApiBaseUrl } from './base-url';

export type ApiHealthResult =
  { kind: 'report'; httpStatus: number; report: HealthReport; requestId?: string } | ApiFailure;

/**
 * Asks the API for its health, server-side. Never throws.
 *
 * 503 with a valid body is a valid answer ("the API is up but its database is not"), so it is
 * parsed like 200 rather than treated as unreachable. API reachability, database connectivity and
 * PostGIS are three separate facts in the report; none of them says anything about business data.
 */
export async function getApiHealth(
  options: Omit<ApiGetOptions, 'acceptStatuses'> = {},
): Promise<ApiHealthResult> {
  const result = await apiGet('/health', healthReportSchema, {
    ...options,
    acceptStatuses: [200, 503],
  });
  if (result.kind !== 'ok') return result;
  return {
    kind: 'report',
    httpStatus: result.httpStatus,
    report: result.data,
    requestId: result.requestId,
  };
}
