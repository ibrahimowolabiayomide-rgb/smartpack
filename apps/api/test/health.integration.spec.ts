import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { apiErrorSchema, healthResponseSchema } from '@smartpack/shared';
import request from 'supertest';
import {
  createTestApp,
  migrateTestDatabase,
  testConfig,
  unreachableDatabaseUrl,
} from './helpers.js';

describe('GET /api/v1/health (real PostgreSQL)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await migrateTestDatabase();
    app = await createTestApp(testConfig());
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a healthy database and enabled PostGIS from live queries', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const parsed = healthResponseSchema.parse(response.body);
    expect(parsed.data.status).toBe('ok');
    expect(parsed.data.checks.database.status).toBe('up');
    expect(parsed.data.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(parsed.data.checks.postgis.status).toBe('enabled');
    expect(parsed.data.service).toBe('smartpack-api');
  });

  it('is never cached', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('measures uptime that increases between calls', async () => {
    const first = healthResponseSchema.parse(
      (await request(app.getHttpServer()).get('/api/v1/health')).body,
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const second = healthResponseSchema.parse(
      (await request(app.getHttpServer()).get('/api/v1/health')).body,
    );
    expect(second.data.uptimeSeconds).toBeGreaterThan(first.data.uptimeSeconds);
    expect(new Date(second.data.timestamp).getTime()).toBeGreaterThan(
      new Date(first.data.timestamp).getTime(),
    );
  });

  it('is not available without the API prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});

describe('GET /api/v1/health when the database is unreachable', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp(
      testConfig({
        DATABASE_URL: unreachableDatabaseUrl(),
        DATABASE_CONNECTION_TIMEOUT_MS: '1000',
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 503 and never claims the database is up', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);
    const parsed = healthResponseSchema.parse(response.body);
    expect(parsed.data.status).toBe('error');
    expect(parsed.data.checks.database).toEqual({ status: 'down', latencyMs: null });
    expect(parsed.data.checks.postgis.status).toBe('unknown');
  });

  it('does not leak connection details in the body', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);
    const text = JSON.stringify(response.body);
    expect(text).not.toMatch(/ECONNREFUSED|postgres|127\.0\.0\.1|password/i);
  });
});

describe('GET /api/v1/health when PostGIS is not installed', () => {
  // Uses a throwaway database without the extension, so the "degraded" path is proven against
  // a real server rather than a mock.
  const scratchName = `smartpack_nopostgis_${process.pid}`;
  let app: NestFastifyApplication;
  let adminUrl: URL;

  beforeAll(async () => {
    const { default: pg } = await import('pg');
    adminUrl = new URL(testConfig().database.url);
    const admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    try {
      await admin.query(`create database ${scratchName}`);
    } finally {
      await admin.end();
    }
    const scratchUrl = new URL(adminUrl.toString());
    scratchUrl.pathname = `/${scratchName}`;
    app = await createTestApp(testConfig({ DATABASE_URL: scratchUrl.toString() }));
  });

  afterAll(async () => {
    await app.close();
    const { default: pg } = await import('pg');
    const admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    try {
      await admin.query(`drop database if exists ${scratchName} with (force)`);
    } finally {
      await admin.end();
    }
  });

  it('answers 200 with status degraded and postgis missing', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const parsed = healthResponseSchema.parse(response.body);
    expect(parsed.data.status).toBe('degraded');
    expect(parsed.data.checks.database.status).toBe('up');
    expect(parsed.data.checks.postgis.status).toBe('missing');
  });
});

describe('error envelope', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp(testConfig());
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps unknown routes in the standard error body', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    const parsed = apiErrorSchema.parse(response.body);
    expect(parsed.error.code).toBe('NOT_FOUND');
    expect(parsed.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('rejects disallowed methods with the standard body', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/health').send({});
    expect([404, 405]).toContain(response.status);
    expect(apiErrorSchema.safeParse(response.body).success).toBe(true);
  });
});
