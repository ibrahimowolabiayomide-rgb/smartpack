/**
 * Where to send someone after signing in. Only paths inside the signed-in area are accepted, so
 * a crafted `?next=` can never bounce a person to another site (open redirect) or to a page that
 * is not part of the application.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  const ok =
    decoded.startsWith('/dashboard') &&
    !decoded.startsWith('//') &&
    !decoded.includes('\\') &&
    // Control characters (including line breaks) have no place in a path.
    !/[\u0000-\u001f]/.test(decoded) &&
    !/^\/dashboard[a-z]/i.test(decoded);
  return ok ? decoded : fallback;
}
