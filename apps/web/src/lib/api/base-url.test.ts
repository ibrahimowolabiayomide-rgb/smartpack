import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './base-url';

describe('resolveApiBaseUrl', () => {
  it('uses API_URL and strips trailing slashes', () => {
    expect(resolveApiBaseUrl({ API_URL: 'https://api.example.com/api/v1//' })).toEqual({
      ok: true,
      url: 'https://api.example.com/api/v1',
    });
  });

  it('assumes localhost only in development', () => {
    expect(resolveApiBaseUrl({ NODE_ENV: 'development' })).toEqual({
      ok: true,
      url: 'http://127.0.0.1:4000/api/v1',
    });
    expect(resolveApiBaseUrl({ NODE_ENV: 'production' })).toEqual({ ok: false, reason: 'missing' });
    expect(resolveApiBaseUrl({})).toEqual({ ok: false, reason: 'missing' });
  });

  it('treats a blank value as missing', () => {
    expect(resolveApiBaseUrl({ API_URL: '   ', NODE_ENV: 'production' })).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  it.each(['not a url', 'ftp://api.example.com', 'javascript:alert(1)'])(
    'rejects %s as invalid',
    (value) => {
      expect(resolveApiBaseUrl({ API_URL: value })).toEqual({ ok: false, reason: 'invalid' });
    },
  );
});
