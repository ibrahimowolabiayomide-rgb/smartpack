import { NextResponse, type NextRequest } from 'next/server';
import { hasSessionCookie } from '@/lib/auth/cookies';

/**
 * First, cheap gate for the signed-in area: a request with no session cookie at all is sent to
 * sign-in right away, remembering where it was going. This only looks for the cookie's presence.
 * Whether the session is actually valid is decided by the API, on every page, in the app layout.
 */
export function proxy(request: NextRequest) {
  const present = request.cookies.getAll().map((cookie) => cookie.name);
  if (hasSessionCookie(present)) return NextResponse.next();

  const target = new URL('/login', request.url);
  const { pathname, search } = request.nextUrl;
  target.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(target);
}

export const config = { matcher: ['/dashboard/:path*'] };
