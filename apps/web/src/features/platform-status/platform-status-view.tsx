import type { HealthReport } from '@smartpack/shared';
import { ErrorState } from '@/components/ui/error-state';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import type { ApiHealthResult } from '@/lib/api/health';

const timestampFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'UTC',
});

export function formatCheckedAt(iso: string): string {
  return `${timestampFormat.format(new Date(iso))} UTC`;
}

interface Row {
  label: string;
  value: { tone: StatusTone; text: string } | { mono: string };
}

export function buildRows(report: HealthReport): Row[] {
  const { database, postgis } = report.checks;
  return [
    { label: 'API service', value: { tone: 'positive', text: 'Reachable' } },
    {
      label: 'Database',
      value:
        database.status === 'up'
          ? { tone: 'positive', text: 'Connected' }
          : { tone: 'critical', text: 'Down' },
    },
    {
      label: 'PostGIS extension',
      value:
        postgis.status === 'enabled'
          ? { tone: 'positive', text: 'Enabled' }
          : postgis.status === 'missing'
            ? { tone: 'warning', text: 'Not installed' }
            : { tone: 'neutral', text: 'Unknown' },
    },
    {
      label: 'Database response time',
      value: { mono: database.latencyMs === null ? 'Not measured' : `${database.latencyMs} ms` },
    },
    { label: 'API version', value: { mono: report.version } },
    { label: 'Environment', value: { mono: report.environment } },
  ];
}

const overall: Record<HealthReport['status'], { tone: StatusTone; text: string }> = {
  ok: { tone: 'positive', text: 'All systems operational' },
  degraded: { tone: 'warning', text: 'Degraded' },
  error: { tone: 'critical', text: 'Database unavailable' },
};

/** Appends the request id, which locates the call in the API log, when there is one. */
function withRequestId(detail: string, requestId: string | undefined): string {
  return requestId ? `${detail} Request ID: ${requestId}` : detail;
}

export function describeFailure(result: Exclude<ApiHealthResult, { kind: 'report' }>): {
  title: string;
  description: string;
  detail: string;
} {
  switch (result.kind) {
    case 'unconfigured':
      return {
        title: 'The API address is not configured',
        description:
          'The web application does not know where the SmartPack API is, so it cannot report its status.',
        detail:
          result.reason === 'missing'
            ? 'API_URL is not set.'
            : 'API_URL is not a valid http(s) URL.',
      };
    case 'unreachable':
      return {
        title: 'The API could not be reached',
        description:
          'No response came back from the API. Check that it is running and that the web application is pointed at it.',
        detail: withRequestId(
          result.reason === 'timeout' ? 'The request timed out.' : 'The connection failed.',
          result.requestId,
        ),
      };
    case 'http-error':
      return {
        title: 'The API returned an unexpected status',
        description:
          'The API (or a gateway in front of it) answered, but not with a health report.',
        detail: withRequestId(
          `HTTP ${result.httpStatus}${result.error ? `, ${result.error.code}` : ''}.`,
          result.requestId,
        ),
      };
    case 'invalid-response':
      return {
        title: 'The API response was not recognised',
        description:
          'The API answered, but the body did not match the expected health report format.',
        detail: withRequestId(`HTTP ${result.httpStatus}.`, result.requestId),
      };
  }
}

/** Presentational: renders any health result. Data fetching lives in platform-status.tsx. */
export function PlatformStatusView({ result }: { result: ApiHealthResult }) {
  if (result.kind !== 'report') {
    const failure = describeFailure(result);
    return <ErrorState {...failure} />;
  }

  const { report } = result;
  const summary = overall[report.status];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={summary.tone}>{summary.text}</StatusBadge>
        <p className="text-meta text-ink-subtle">Checked {formatCheckedAt(report.timestamp)}</p>
      </div>
      <dl className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
        {buildRows(report).map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-line py-2.5"
          >
            <dt className="text-ink-muted">{row.label}</dt>
            <dd>
              {'text' in row.value ? (
                <StatusBadge tone={row.value.tone}>{row.value.text}</StatusBadge>
              ) : (
                <span className="font-mono text-meta text-ink">{row.value.mono}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
