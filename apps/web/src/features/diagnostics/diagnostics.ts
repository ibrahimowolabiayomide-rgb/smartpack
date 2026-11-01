import type { ApiHealthResult } from '@/lib/api/health';

export interface DiagnosticsInput {
  webVersion: string;
  webMode: string;
  /** ISO timestamp the text is generated at. */
  generatedAt: string;
  health: ApiHealthResult;
}

function describeApi(health: ApiHealthResult): string[] {
  switch (health.kind) {
    case 'report': {
      const { report } = health;
      return [
        'API: reachable',
        `API version: ${report.version}`,
        `API environment: ${report.environment}`,
        `API overall status: ${report.status}`,
        `Database: ${report.checks.database.status === 'up' ? 'connected' : 'down'}`,
        `PostGIS: ${report.checks.postgis.status}`,
      ];
    }
    case 'unconfigured':
      return [
        'API: not configured',
        `Reason: API_URL is ${health.reason === 'missing' ? 'not set' : 'not a valid http(s) address'}`,
      ];
    case 'unreachable':
      return [
        'API: unreachable',
        `Reason: ${health.reason === 'timeout' ? 'the request timed out' : 'the connection failed'}`,
      ];
    case 'http-error':
      return [
        'API: returned an unexpected response',
        `HTTP status: ${health.httpStatus}`,
        ...(health.error ? [`API error code: ${health.error.code}`] : []),
      ];
    case 'invalid-response':
      return [
        'API: returned a response that was not recognised',
        `HTTP status: ${health.httpStatus}`,
      ];
  }
}

/**
 * Plain text a person can paste into a support message. It deliberately contains no address,
 * credential or user data: only build versions, the observed state of each service and the
 * request id that locates the call in the API log.
 */
export function buildDiagnosticsText(input: DiagnosticsInput): string {
  const requestId = 'requestId' in input.health ? input.health.requestId : undefined;
  return [
    'SmartPack diagnostics',
    `Generated: ${input.generatedAt}`,
    `Web build: v${input.webVersion} (${input.webMode})`,
    ...describeApi(input.health),
    ...(requestId ? [`Request ID: ${requestId}`] : []),
  ].join('\n');
}
