import { NextResponse, type NextRequest } from 'next/server';
import { resolveApiBaseUrl } from '@/lib/api/base-url';
import { sessionCookieHeader } from '@/lib/auth/cookies';

/**
 * Same-origin gateway to the SmartPack API.
 *
 * Why it exists: the browser talks only to this web origin, so the session cookie is host-only and
 * HttpOnly, no CORS is needed, and the API address never reaches the browser. The target is read
 * from `API_URL` on every request (not at build time), so one build serves any environment.
 *
 * What it forwards: method, body, content type, the original Origin (the API's CSRF check needs
 * it), a request id, the client address, and ONLY the session cookie. What it returns: status,
 * body, `Set-Cookie`, `Retry-After`, `Cache-Control` and the request id. The developer mailbox is
 * never reachable through it.
 */

const UPSTREAM_TIMEOUT_MS = 15_000;
const FORWARDED_REQUEST_HEADERS = ['content-type', 'origin', 'referer', 'user-agent', 'accept'];
const RETURNED_RESPONSE_HEADERS = ['content-type', 'retry-after', 'x-request-id'];

type RouteContext = { params: Promise<{ path: string[] }> };

function failure(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json(
    { error: { code, message, statusCode: status, requestId } },
    { status, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
  );
}

async function forward(request: NextRequest, context: RouteContext): Promise<Response> {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const { path } = await context.params;

  // Only plain path segments; no traversal and never the developer mailbox.
  if (path.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return failure(404, 'NOT_FOUND', 'Not found.', requestId);
  }
  if (path[0] === 'dev') return failure(404, 'NOT_FOUND', 'Not found.', requestId);

  const base = resolveApiBaseUrl(process.env);
  if (!base.ok) {
    return failure(
      503,
      'SERVICE_UNAVAILABLE',
      'The SmartPack service is not configured.',
      requestId,
    );
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-request-id', requestId);
  const cookie = sessionCookieHeader((name) => request.cookies.get(name)?.value);
  if (cookie) headers.set('cookie', cookie);
  // Set by the platform in front of this app (for example Vercel); the API trusts it only when
  // TRUST_PROXY_HOPS says so. Never invented here.
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(
      `${base.url}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        // Required by Node's fetch when streaming a request body.
        ...(hasBody ? { duplex: 'half' } : {}),
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      } as RequestInit,
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return failure(
      timedOut ? 504 : 502,
      'SERVICE_UNAVAILABLE',
      timedOut
        ? 'The SmartPack service took too long to answer.'
        : 'The SmartPack service is unreachable.',
      requestId,
    );
  }

  const out = new Headers({ 'cache-control': 'no-store' });
  for (const name of RETURNED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const cookieValue of upstream.headers.getSetCookie()) out.append('set-cookie', cookieValue);
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
