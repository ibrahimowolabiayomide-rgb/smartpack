import { describe, expect, it } from 'vitest';
import { hasSessionCookie, sessionCookieHeader } from './cookies';
import { safeNextPath } from './next-path';

describe('safeNextPath', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard/settings/members?page=2', '/dashboard/settings/members?page=2'],
    [undefined, '/dashboard'],
    ['', '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['/login', '/dashboard'],
    ['/dashboardx', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['/dashboard%0d%0aSet-Cookie:x', '/dashboard'],
    ['%2F%2Fevil.example', '/dashboard'],
    ['%E0%A4%A', '/dashboard'],
  ])('%s -> %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe('session cookie helpers', () => {
  it('recognises either cookie name', () => {
    expect(hasSessionCookie(['sp_session'])).toBe(true);
    expect(hasSessionCookie(['__Host-sp_session'])).toBe(true);
    expect(hasSessionCookie(['theme', 'other'])).toBe(false);
  });

  it('forwards only the session cookie, preferring the production name', () => {
    const jar: Record<string, string> = {
      theme: 'dark',
      sp_session: 'dev',
      '__Host-sp_session': 'prod',
    };
    expect(sessionCookieHeader((name) => jar[name])).toBe('__Host-sp_session=prod');
    delete jar['__Host-sp_session'];
    expect(sessionCookieHeader((name) => jar[name])).toBe('sp_session=dev');
    expect(sessionCookieHeader(() => undefined)).toBeUndefined();
  });
});
