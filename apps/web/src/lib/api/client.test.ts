import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { apiGet } from './client';

const env = { API_URL: 'http://api.test/api/v1' };
const itemSchema = z.object({ id: z.string(), count: z.number() });

function respond(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): typeof fetch {
  return vi.fn(() => Promise.resolve(Response.json(body, { status, headers })));
}

describe('apiGet', () => {
  it('returns validated data from the success envelope', async () => {
    const result = await apiGet('/things', itemSchema, {
      env,
      fetchImpl: respond(200, { data: { id: 'a', count: 2 } }),
    });
    expect(result).toMatchObject({ kind: 'ok', httpStatus: 200, data: { id: 'a', count: 2 } });
  });

  it('sends a unique request id and never allows caching', async () => {
    const fetchImpl = respond(200, { data: { id: 'a', count: 2 } });
    await apiGet('/things', itemSchema, { env, fetchImpl });
    await apiGet('/things', itemSchema, { env, fetchImpl });
    const calls = vi.mocked(fetchImpl).mock.calls;
    const ids = calls.map(([, init]) => (init?.headers as Record<string, string>)['x-request-id']);
    expect(ids[0]).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    expect(ids[0]).not.toBe(ids[1]);
    expect(calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('prefers the request id the API echoed back', async () => {
    const result = await apiGet('/things', itemSchema, {
      env,
      fetchImpl: respond(
        200,
        { data: { id: 'a', count: 1 } },
        { 'x-request-id': 'server-id-12345' },
      ),
    });
    expect(result).toMatchObject({ kind: 'ok', requestId: 'server-id-12345' });
  });

  it('reads the API error envelope of a failed request', async () => {
    const result = await apiGet('/things', itemSchema, {
      env,
      fetchImpl: respond(
        404,
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Cannot GET /things',
            statusCode: 404,
            requestId: 'abc-12345',
          },
        },
        { 'x-request-id': 'abc-12345' },
      ),
    });
    expect(result).toEqual({
      kind: 'http-error',
      httpStatus: 404,
      requestId: 'abc-12345',
      error: { code: 'NOT_FOUND', message: 'Cannot GET /things' },
    });
  });

  it('reports an HTTP error whose body is not a SmartPack envelope without inventing detail', async () => {
    const result = await apiGet('/things', itemSchema, {
      env,
      fetchImpl: respond(502, '<html>Bad gateway</html>'),
    });
    expect(result).toMatchObject({ kind: 'http-error', httpStatus: 502 });
    expect(result).not.toHaveProperty('error');
  });

  it('rejects a 200 that breaks the contract', async () => {
    const result = await apiGet('/things', itemSchema, {
      env,
      fetchImpl: respond(200, { data: { id: 7 } }),
    });
    expect(result).toMatchObject({ kind: 'invalid-response', httpStatus: 200 });
  });

  it('treats an accepted non-2xx status with an unknown body as an HTTP error', async () => {
    const result = await apiGet('/things', itemSchema, {
      env,
      acceptStatuses: [200, 503],
      fetchImpl: respond(503, { nope: true }),
    });
    expect(result).toMatchObject({ kind: 'http-error', httpStatus: 503 });
  });

  it('keeps the request id when the API cannot be reached, so the attempt can be traced', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
    const result = await apiGet('/things', itemSchema, { env, fetchImpl });
    expect(result).toMatchObject({ kind: 'unreachable', reason: 'network' });
    expect(result).toHaveProperty('requestId');
  });

  it('does not call the network when the API address is invalid', async () => {
    const fetchImpl = vi.fn();
    const result = await apiGet('/things', itemSchema, { env: { API_URL: 'ftp://x' }, fetchImpl });
    expect(result).toEqual({ kind: 'unconfigured', reason: 'invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
