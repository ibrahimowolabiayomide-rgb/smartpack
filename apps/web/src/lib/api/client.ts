import { apiErrorSchema, apiSuccessSchema, type ApiErrorCode } from '@smartpack/shared';
import type { z } from 'zod';
import { resolveApiBaseUrl } from './base-url';

const DEFAULT_TIMEOUT_MS = 4_000;
const REQUEST_ID_HEADER = 'x-request-id';

/** The API's own description of a failed request, taken from its error envelope. */
export interface ApiErrorInfo {
  code: ApiErrorCode;
  message: string;
}

/**
 * Every way a call to the API can fail, described. Callers branch on `kind`, never on message
 * text. `requestId` matches the `x-request-id` in the API logs, so a user report can be traced.
 */
export type ApiFailure =
  | { kind: 'unconfigured'; reason: 'missing' | 'invalid' }
  | { kind: 'unreachable'; reason: 'timeout' | 'network'; requestId?: string }
  | { kind: 'http-error'; httpStatus: number; error?: ApiErrorInfo; requestId?: string }
  | { kind: 'invalid-response'; httpStatus: number; requestId?: string };

export type ApiResult<T> =
  { kind: 'ok'; httpStatus: number; data: T; requestId?: string } | ApiFailure;

export interface ApiGetOptions {
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  /**
   * Statuses whose body is the success envelope. Defaults to `[200]`. The health endpoint also
   * answers 503 with a valid report ("the API is up, its database is not"), which is information
   * and not a transport failure.
   */
  acceptStatuses?: readonly number[];
  /** Injection point for unit tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Matches an error by name rather than class: DOMException (what AbortSignal.timeout rejects with)
 * is not guaranteed to be `instanceof Error` across runtimes and test environments.
 */
function isNamedError(error: unknown, name: string): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === name;
}

/**
 * GET a JSON resource from the SmartPack API, server-side. Never throws: every failure is a
 * described result, so a page can show an honest state instead of crashing.
 *
 * - The URL comes from `API_URL` (server environment only).
 * - Every request has a timeout and is never cached (`no-store`); private data must not be served
 *   from a shared cache.
 * - The body is validated against the shared Zod contract. A response that does not match is
 *   reported as `invalid-response`, never trusted.
 * - A unique `x-request-id` is sent so the API log line and any error shown to a person agree.
 */
export async function apiGet<S extends z.ZodType>(
  path: `/${string}`,
  dataSchema: S,
  options: ApiGetOptions = {},
): Promise<ApiResult<z.infer<S>>> {
  const {
    env = process.env,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    acceptStatuses = [200],
    fetchImpl = fetch,
  } = options;

  const base = resolveApiBaseUrl(env);
  if (!base.ok) return { kind: 'unconfigured', reason: base.reason };

  const sentRequestId = crypto.randomUUID();
  let response: Response;
  try {
    response = await fetchImpl(`${base.url}${path}`, {
      cache: 'no-store',
      headers: { accept: 'application/json', [REQUEST_ID_HEADER]: sentRequestId },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = isNamedError(error, 'TimeoutError');
    return {
      kind: 'unreachable',
      reason: timedOut ? 'timeout' : 'network',
      requestId: sentRequestId,
    };
  }

  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? sentRequestId;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (acceptStatuses.includes(response.status)) {
    const parsed = apiSuccessSchema(dataSchema).safeParse(body);
    if (parsed.success) {
      return {
        kind: 'ok',
        httpStatus: response.status,
        data: (parsed.data as { data: z.infer<S> }).data,
        requestId,
      };
    }
    // A 2xx that breaks the contract is a SmartPack problem. A non-2xx the contract does not
    // describe (for example a 503 page from a proxy) is just an HTTP error.
    return response.status >= 200 && response.status < 300
      ? { kind: 'invalid-response', httpStatus: response.status, requestId }
      : { kind: 'http-error', httpStatus: response.status, requestId };
  }

  const envelope = apiErrorSchema.safeParse(body);
  return {
    kind: 'http-error',
    httpStatus: response.status,
    requestId,
    ...(envelope.success
      ? { error: { code: envelope.data.error.code, message: envelope.data.error.message } }
      : {}),
  };
}
