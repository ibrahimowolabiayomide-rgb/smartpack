import type { HealthReport } from '@smartpack/shared';
import { describe, expect, it } from 'vitest';
import { buildDiagnosticsText } from './diagnostics';

const report: HealthReport = {
  status: 'ok',
  service: 'smartpack-api',
  version: '0.1.0',
  environment: 'production',
  timestamp: '2026-10-31T10:00:00.000Z',
  uptimeSeconds: 12,
  checks: { database: { status: 'up', latencyMs: 3 }, postgis: { status: 'enabled' } },
};
const base = {
  webVersion: '0.2.0',
  webMode: 'production',
  generatedAt: '2026-10-31T10:00:01.000Z',
};

describe('buildDiagnosticsText', () => {
  it('states the observed service state and the request id', () => {
    const text = buildDiagnosticsText({
      ...base,
      health: { kind: 'report', httpStatus: 200, report, requestId: 'req-12345678' },
    });
    expect(text).toContain('Web build: v0.2.0 (production)');
    expect(text).toContain('API: reachable');
    expect(text).toContain('Database: connected');
    expect(text).toContain('PostGIS: enabled');
    expect(text).toContain('Request ID: req-12345678');
  });

  it('reports a database outage as an outage, not as an unreachable API', () => {
    const text = buildDiagnosticsText({
      ...base,
      health: {
        kind: 'report',
        httpStatus: 503,
        report: {
          ...report,
          status: 'error',
          checks: { database: { status: 'down', latencyMs: null }, postgis: { status: 'unknown' } },
        },
      },
    });
    expect(text).toContain('API: reachable');
    expect(text).toContain('Database: down');
  });

  it.each([
    [{ kind: 'unconfigured', reason: 'missing' } as const, 'API: not configured'],
    [{ kind: 'unreachable', reason: 'timeout' } as const, 'the request timed out'],
    [{ kind: 'http-error', httpStatus: 502 } as const, 'HTTP status: 502'],
    [{ kind: 'invalid-response', httpStatus: 200 } as const, 'not recognised'],
  ])('describes failure %#', (health, expected) => {
    expect(buildDiagnosticsText({ ...base, health })).toContain(expected);
  });

  it('never includes an address or credential', () => {
    const text = buildDiagnosticsText({
      ...base,
      health: { kind: 'unconfigured', reason: 'invalid' },
    });
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/password|secret|token/i);
  });
});
