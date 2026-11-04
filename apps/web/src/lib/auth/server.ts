import { currentUserSchema, type CurrentUser } from '@smartpack/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { z } from 'zod';
import { apiGet, type ApiFailure, type ApiResult } from '@/lib/api/client';
import { sessionCookieHeader } from './cookies';

export type SessionState =
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'anonymous' }
  | { status: 'unavailable'; failure: ApiFailure };

/** The signed-in person's session cookie as a request header, or undefined when signed out. */
async function cookieHeader(): Promise<string | undefined> {
  const store = await cookies();
  return sessionCookieHeader((name) => store.get(name)?.value);
}

/**
 * Asks the API who the caller is. Cached for the duration of one render, so a layout and its
 * pages share one lookup. A missing, expired or revoked session is `anonymous`; an API that
 * cannot be reached is `unavailable` and is never mistaken for "signed out".
 */
export const getSession = cache(async (): Promise<SessionState> => {
  const cookie = await cookieHeader();
  if (!cookie) return { status: 'anonymous' };
  const result = await apiGet('/auth/me', currentUserSchema, { headers: { cookie } });
  if (result.kind === 'ok') return { status: 'authenticated', user: result.data };
  if (result.kind === 'http-error' && (result.httpStatus === 401 || result.httpStatus === 403)) {
    return { status: 'anonymous' };
  }
  return { status: 'unavailable', failure: result };
});

/** GET a private resource on behalf of the signed-in person. */
export async function authedGet<S extends z.ZodType>(
  path: `/${string}`,
  schema: S,
): Promise<ApiResult<z.infer<S>>> {
  const cookie = await cookieHeader();
  return apiGet(path, schema, { headers: cookie ? { cookie } : {} });
}
