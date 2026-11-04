import { apiErrorSchema, apiSuccessSchema, type ApiErrorCode } from '@smartpack/shared';
import type { z } from 'zod';

/** Field-level messages from the API, keyed by the last segment of the input path. */
export type FieldErrors = Record<string, string>;

export interface RequestFailure {
  ok: false;
  httpStatus: number;
  code: ApiErrorCode | 'NETWORK' | 'INVALID_RESPONSE';
  /** The API's own message, or a description of a transport failure. For people to read. */
  message: string;
  fieldErrors: FieldErrors;
  retryAfterSeconds?: number;
  requestId?: string;
}

export type RequestResult<T> = { ok: true; httpStatus: number; data: T } | RequestFailure;

const BROWSER_TIMEOUT_MS = 20_000;

function lastSegment(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1] ?? path;
}

/**
 * Calls the API from the browser through this app's same-origin gateway (`/api/v1/...`), so the
 * HttpOnly session cookie is attached by the browser and no API address is exposed. Never throws:
 * every failure is described, so a form can show an honest message.
 *
 * Responses are checked against the shared contract; one that does not match is reported as
 * INVALID_RESPONSE rather than trusted.
 */
export async function apiRequest<S extends z.ZodType>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: `/${string}`,
  options: { body?: unknown; schema: S; fetchImpl?: typeof fetch },
): Promise<RequestResult<z.infer<S>>> {
  const { body, schema, fetchImpl = fetch } = options;
  let response: Response;
  try {
    response = await fetchImpl(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(BROWSER_TIMEOUT_MS),
    });
  } catch {
    return {
      ok: false,
      httpStatus: 0,
      code: 'NETWORK',
      message: 'Could not reach the SmartPack service. Check your connection and try again.',
      fieldErrors: {},
    };
  }

  const requestId = response.headers.get('x-request-id') ?? undefined;
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }

  if (response.ok) {
    const parsed = apiSuccessSchema(schema).safeParse(json);
    if (parsed.success) {
      return {
        ok: true,
        httpStatus: response.status,
        data: (parsed.data as { data: z.infer<S> }).data,
      };
    }
    return {
      ok: false,
      httpStatus: response.status,
      code: 'INVALID_RESPONSE',
      message: 'The service returned an answer this app does not understand.',
      fieldErrors: {},
      requestId,
    };
  }

  const envelope = apiErrorSchema.safeParse(json);
  const retryAfter = Number(response.headers.get('retry-after'));
  if (!envelope.success) {
    return {
      ok: false,
      httpStatus: response.status,
      code:
        response.status === 503 || response.status === 502 || response.status === 504
          ? 'NETWORK'
          : 'INVALID_RESPONSE',
      message: 'The SmartPack service is not available right now. Try again shortly.',
      fieldErrors: {},
      requestId,
    };
  }
  const fieldErrors: FieldErrors = {};
  for (const detail of envelope.data.error.details ?? []) {
    const key = lastSegment(detail.path);
    if (key && !(key in fieldErrors)) fieldErrors[key] = detail.message;
  }
  return {
    ok: false,
    httpStatus: response.status,
    code: envelope.data.error.code,
    message: envelope.data.error.message,
    fieldErrors,
    requestId: envelope.data.error.requestId || requestId,
    ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
  };
}

/** A sentence a person can act on, for a failure that is not shown against a specific field. */
export function describeFailure(failure: RequestFailure): string {
  switch (failure.code) {
    case 'RATE_LIMITED': {
      const wait = failure.retryAfterSeconds;
      if (!wait) return 'Too many attempts. Wait a little while and try again.';
      const minutes = Math.ceil(wait / 60);
      return wait < 90
        ? `Too many attempts. Try again in ${wait} seconds.`
        : `Too many attempts. Try again in about ${minutes} minutes.`;
    }
    case 'UNAUTHORIZED':
      return 'Your session has ended. Sign in again to continue.';
    case 'FORBIDDEN':
      return 'You do not have permission to do that.';
    case 'NETWORK':
    case 'INVALID_RESPONSE':
      return failure.message;
    case 'INTERNAL_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return 'Something went wrong on our side. Try again shortly.';
    default:
      return failure.message;
  }
}
