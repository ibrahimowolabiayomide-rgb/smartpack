import type { HealthReport } from '@smartpack/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ApiHealthResult } from '@/lib/api-health';
import {
  PlatformStatusView,
  buildRows,
  describeFailure,
  formatCheckedAt,
} from './platform-status-view';

const report: HealthReport = {
  status: 'ok',
  service: 'smartpack-api',
  version: '0.1.0',
  environment: 'development',
  timestamp: '2026-10-30T03:33:36.000Z',
  uptimeSeconds: 42,
  checks: { database: { status: 'up', latencyMs: 15 }, postgis: { status: 'enabled' } },
};

const withReport = (overrides: Partial<HealthReport>): ApiHealthResult => ({
  kind: 'report',
  httpStatus: 200,
  report: { ...report, ...overrides },
});

describe('PlatformStatusView with a report', () => {
  it('shows a healthy platform with real values', () => {
    render(<PlatformStatusView result={withReport({})} />);
    expect(screen.getByText('All systems operational')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('15 ms')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByText(/30 Oct 2026, 03:33:36 UTC/)).toBeInTheDocument();
  });

  it('never shows Connected when the database is down', () => {
    render(
      <PlatformStatusView
        result={withReport({
          status: 'error',
          checks: { database: { status: 'down', latencyMs: null }, postgis: { status: 'unknown' } },
        })}
      />,
    );
    expect(screen.getByText('Database unavailable')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('All systems operational')).not.toBeInTheDocument();
  });

  it('flags a missing PostGIS extension as a warning', () => {
    render(
      <PlatformStatusView
        result={withReport({
          status: 'degraded',
          checks: { database: { status: 'up', latencyMs: 3 }, postgis: { status: 'missing' } },
        })}
      />,
    );
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('Not installed')).toBeInTheDocument();
  });

  it('shows a dash instead of an invented latency when none was measured', () => {
    const rows = buildRows({
      ...report,
      checks: { database: { status: 'down', latencyMs: null }, postgis: { status: 'unknown' } },
    });
    const latency = rows.find((row) => row.label === 'Database response time');
    expect(latency?.value).toEqual({ mono: '—' });
  });
});

describe('PlatformStatusView failures', () => {
  const failures: Array<[string, ApiHealthResult, RegExp]> = [
    ['missing configuration', { kind: 'unconfigured', reason: 'missing' }, /API_URL is not set/],
    [
      'invalid configuration',
      { kind: 'unconfigured', reason: 'invalid' },
      /not a valid http\(s\) URL/,
    ],
    ['timeout', { kind: 'unreachable', reason: 'timeout' }, /timed out/],
    ['network error', { kind: 'unreachable', reason: 'network' }, /connection failed/],
    ['http error', { kind: 'http-error', httpStatus: 502 }, /HTTP 502/],
    ['invalid body', { kind: 'invalid-response', httpStatus: 200 }, /HTTP 200/],
  ];

  it.each(failures)('shows an error alert for %s and no success state', (_name, result, detail) => {
    render(<PlatformStatusView result={result} />);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(detail)).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('All systems operational')).not.toBeInTheDocument();
  });

  it('gives each failure kind its own title', () => {
    const titles = failures.map(([, result]) => {
      if (result.kind === 'report') throw new Error('unreachable');
      return describeFailure(result).title;
    });
    expect(new Set(titles).size).toBeGreaterThanOrEqual(4);
  });
});

describe('formatCheckedAt', () => {
  it('formats in UTC regardless of the server time zone', () => {
    expect(formatCheckedAt('2026-10-30T23:59:59.000Z')).toBe('30 Oct 2026, 23:59:59 UTC');
  });
});
