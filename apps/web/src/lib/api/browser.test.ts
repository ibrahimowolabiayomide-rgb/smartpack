import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiRequest, describeFailure } from './browser';

const schema = z.object({ n: z.number() });
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('apiRequest', () => {
  it('unwraps a valid success envelope and calls the same-origin gateway', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { data: { n: 1 } }));
    const result = await apiRequest('POST', '/things', { body: { a: 1 }, schema, fetchImpl });
    expect(result).toMatchObject({ ok: true, data: { n: 1 } });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/things');
    expect(init.credentials).toBe('same-origin');
    expect(init.cache).toBe('no-store');
  });

  it('refuses a success body that breaks the contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { data: { n: 'x' } }));
    const result = await apiRequest('GET', '/things', { schema, fetchImpl });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
  });

  it('maps validation details to field errors by their last path segment', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid',
          statusCode: 400,
          requestId: 'r',
          details: [
            { path: 'body.email', message: 'Bad email' },
            { path: 'password', message: 'Too short' },
          ],
        },
      }),
    );
    const result = await apiRequest('POST', '/x', { body: {}, schema, fetchImpl });
    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_FAILED',
      fieldErrors: { email: 'Bad email', password: 'Too short' },
    });
  });

  it('carries Retry-After for rate limiting', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json(
        429,
        {
          error: { code: 'RATE_LIMITED', message: 'Slow down', statusCode: 429, requestId: 'r' },
        },
        { 'retry-after': '120' },
      ),
    );
    const result = await apiRequest('POST', '/x', { body: {}, schema, fetchImpl });
    expect(result).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryAfterSeconds: 120 });
    if (!result.ok) expect(describeFailure(result)).toMatch(/2 minutes/);
  });

  it('reports a network failure and a non-envelope gateway error as unavailable', async () => {
    const down = await apiRequest('GET', '/x', {
      schema,
      fetchImpl: vi.fn().mockRejectedValue(new TypeError('x')),
    });
    expect(down).toMatchObject({ ok: false, code: 'NETWORK', httpStatus: 0 });
    const html = await apiRequest('GET', '/x', {
      schema,
      fetchImpl: vi
        .fn()
        .mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 })),
    });
    expect(html).toMatchObject({ ok: false, code: 'NETWORK', httpStatus: 502 });
  });

  it('does not expose server internals in descriptions of internal errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json(500, {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'relation "users" does not exist',
          statusCode: 500,
          requestId: 'r',
        },
      }),
    );
    const result = await apiRequest('GET', '/x', { schema, fetchImpl });
    if (result.ok) throw new Error('expected failure');
    expect(describeFailure(result)).not.toContain('relation');
  });
});
