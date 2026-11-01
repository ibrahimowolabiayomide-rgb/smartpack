import type { HealthResponse } from '@smartpack/shared';
import { describe, expect, it, vi } from 'vitest';
import { getApiHealth } from './health';

const goodBody: HealthResponse = {
  data: {
    status: 'ok',
    service: 'smartpack-api',
    version: '0.1.0',
    environment: 'development',
    timestamp: '2026-10-30T03:00:00.000Z',
    uptimeSeconds: 10,
    checks: { database: { status: 'up', latencyMs: 4 }, postgis: { status: 'enabled' } },
  },
};

const env = { API_URL: 'http://api.test/api/v1' };

function respond(status: number, body: unknown): typeof fetch {
  return vi.fn(() => Promise.resolve(Response.json(body, { status })));
}

describe('getApiHealth', () => {
  it('returns the validated report for a healthy API', async () => {
    const result = await getApiHealth({ env, fetchImpl: respond(200, goodBody) });
    expect(result).toEqual({
      kind: 'report',
      httpStatus: 200,
      report: goodBody.data,
      requestId: expect.any(String),
    });
  });

  it('requests the health URL without caching', async () => {
    const fetchImpl = respond(200, goodBody);
    await getApiHealth({ env, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.test/api/v1/health',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('treats 503 with a valid body as a report about a failing database, not as unreachable', async () => {
    const down: HealthResponse = {
      data: {
        ...goodBody.data,
        status: 'error',
        checks: { database: { status: 'down', latencyMs: null }, postgis: { status: 'unknown' } },
      },
    };
    const result = await getApiHealth({ env, fetchImpl: respond(503, down) });
    expect(result).toMatchObject({ kind: 'report', httpStatus: 503 });
    if (result.kind === 'report') expect(result.report.checks.database.status).toBe('down');
  });

  it('reports an unexpected status as an http error', async () => {
    expect(
      await getApiHealth({ env, fetchImpl: respond(502, { message: 'bad gateway' }) }),
    ).toMatchObject({ kind: 'http-error', httpStatus: 502 });
  });

  it('reports a 503 that is not a SmartPack body (a gateway page) as an http error', async () => {
    expect(await getApiHealth({ env, fetchImpl: respond(503, { oops: true }) })).toMatchObject({
      kind: 'http-error',
      httpStatus: 503,
    });
  });

  it('rejects a 200 whose body does not match the contract', async () => {
    expect(
      await getApiHealth({ env, fetchImpl: respond(200, { data: { status: 'fine' } }) }),
    ).toMatchObject({ kind: 'invalid-response', httpStatus: 200 });
  });

  it('rejects a 200 whose body is not JSON', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(new Response('<html></html>', { status: 200 }));
    expect(await getApiHealth({ env, fetchImpl })).toMatchObject({
      kind: 'invalid-response',
      httpStatus: 200,
    });
  });

  it('reports a network failure as unreachable', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
    expect(await getApiHealth({ env, fetchImpl })).toMatchObject({
      kind: 'unreachable',
      reason: 'network',
    });
  });

  it('reports a timeout distinctly', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
    expect(await getApiHealth({ env, fetchImpl })).toMatchObject({
      kind: 'unreachable',
      reason: 'timeout',
    });
  });

  it('actually times out a hung request', async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    const result = await getApiHealth({ env, fetchImpl, timeoutMs: 50 });
    expect(result).toMatchObject({ kind: 'unreachable', reason: 'timeout' });
  });

  it('does not call the network when the API is not configured', async () => {
    const fetchImpl = vi.fn();
    const result = await getApiHealth({ env: { NODE_ENV: 'production' }, fetchImpl });
    expect(result).toEqual({ kind: 'unconfigured', reason: 'missing' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
