import { healthResponseSchema, type HealthReport } from '@smartpack/shared';

const DEFAULT_TIMEOUT_MS = 4_000;
const DEVELOPMENT_API_URL = 'http://127.0.0.1:4000/api/v1';

export type ApiHealthResult =
  | { kind: 'report'; httpStatus: number; report: HealthReport }
  | { kind: 'unconfigured'; reason: 'missing' | 'invalid' }
  | { kind: 'unreachable'; reason: 'timeout' | 'network' }
  | { kind: 'http-error'; httpStatus: number }
  | { kind: 'invalid-response'; httpStatus: number };

/**
 * Resolves the API base URL from `API_URL`, or reports why it cannot.
 * Only in development is a default assumed; production and preview must be configured explicitly
 * so a missing variable is visible instead of silently pointing at localhost.
 */
export function resolveApiBaseUrl(
  env: Record<string, string | undefined>,
): { ok: true; url: string } | { ok: false; reason: 'missing' | 'invalid' } {
  const raw = env.API_URL?.trim();
  if (!raw) {
    return env.NODE_ENV === 'development'
      ? { ok: true, url: DEVELOPMENT_API_URL }
      : { ok: false, reason: 'missing' };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, url: raw.replace(/\/+$/, '') };
}

/**
 * Matches an error by name rather than class: DOMException (what AbortSignal.timeout rejects with)
 * is not guaranteed to be `instanceof Error` across runtimes and test environments.
 */
function isNamedError(error: unknown, name: string): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === name;
}

export interface GetApiHealthOptions {
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  /** Injection point for unit tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Asks the API for its health, server-side. Never throws: every failure is a described result,
 * so the page can show an honest state instead of crashing.
 *
 * The response is validated against the shared contract. 503 is a valid answer ("the API is up
 * but its database is not"), so it is parsed like 200 rather than treated as unreachable.
 */
export async function getApiHealth(options: GetApiHealthOptions = {}): Promise<ApiHealthResult> {
  const { env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = options;

  const base = resolveApiBaseUrl(env);
  if (!base.ok) return { kind: 'unconfigured', reason: base.reason };

  let response: Response;
  try {
    response = await fetchImpl(`${base.url}/health`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = isNamedError(error, 'TimeoutError');
    return { kind: 'unreachable', reason: timedOut ? 'timeout' : 'network' };
  }

  if (response.status !== 200 && response.status !== 503) {
    return { kind: 'http-error', httpStatus: response.status };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = healthResponseSchema.safeParse(body);
  if (parsed.success) {
    return { kind: 'report', httpStatus: response.status, report: parsed.data.data };
  }
  // A 503 from a proxy or platform is an HTTP error, not a malformed SmartPack response.
  return response.status === 503
    ? { kind: 'http-error', httpStatus: 503 }
    : { kind: 'invalid-response', httpStatus: response.status };
}
