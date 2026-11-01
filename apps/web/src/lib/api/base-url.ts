const DEVELOPMENT_API_URL = 'http://127.0.0.1:4000/api/v1';

export type ApiBaseUrl = { ok: true; url: string } | { ok: false; reason: 'missing' | 'invalid' };

/**
 * Resolves the API base URL from `API_URL`, or reports why it cannot.
 * Only in development is a default assumed; production and preview must be configured explicitly
 * so a missing variable is visible instead of silently pointing at localhost.
 *
 * `API_URL` is read on the server only. It has no `NEXT_PUBLIC_` prefix, so it is never bundled
 * into browser code.
 */
export function resolveApiBaseUrl(env: Record<string, string | undefined>): ApiBaseUrl {
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
