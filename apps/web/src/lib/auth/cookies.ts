/**
 * The session cookie is set by the API (HttpOnly, so scripts cannot read it) and travels through
 * this web app's same-origin proxy. The name depends on the environment: production uses the
 * `__Host-` prefix, which browsers only accept for Secure, host-only, path `/` cookies.
 */
export const SESSION_COOKIE_NAMES = ['__Host-sp_session', 'sp_session'] as const;

/** True when the cookie header carries a session cookie. Says nothing about its validity. */
export function hasSessionCookie(names: Iterable<string>): boolean {
  const present = new Set(names);
  return SESSION_COOKIE_NAMES.some((name) => present.has(name));
}

/**
 * Builds a `Cookie` header containing only the session cookie. Nothing else the browser sent is
 * forwarded to the API.
 */
export function sessionCookieHeader(
  read: (name: string) => string | undefined,
): string | undefined {
  for (const name of SESSION_COOKIE_NAMES) {
    const value = read(name);
    if (value) return `${name}=${value}`;
  }
  return undefined;
}
