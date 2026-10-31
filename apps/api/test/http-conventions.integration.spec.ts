import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { apiErrorSchema } from '@smartpack/shared';
import request from 'supertest';
import { z } from 'zod';
import { createTestApp, migrateTestDatabase, testConfig } from './helpers.js';

const pageQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
const echoBody = z.object({ name: z.string().min(1) });

const openApiDocument = z.object({
  openapi: z.string(),
  paths: z.record(
    z.string(),
    z.object({ get: z.object({ responses: z.record(z.string(), z.unknown()) }).optional() }),
  ),
});

/** Exists only in tests: proves the global pipe, envelope and error handling on a real route. */
@Controller('test-conventions')
class ConventionsTestController {
  @Get('page')
  page(@Query({ schema: pageQuery }) query: z.infer<typeof pageQuery>) {
    return { limit: query.limit };
  }

  @Post('echo')
  echo(@Body({ schema: echoBody }) body: z.infer<typeof echoBody>) {
    return { name: body.name };
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal detail: db password is hunter2');
  }
}

describe('HTTP conventions (development configuration)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await migrateTestDatabase();
    app = await createTestApp(testConfig(), [ConventionsTestController]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('validation and envelopes', () => {
    it('wraps successful results in { data } and applies schema defaults', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/test-conventions/page')
        .expect(200);
      expect(response.body).toEqual({ data: { limit: 20 } });
    });

    it('coerces and accepts valid input', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/test-conventions/page?limit=5')
        .expect(200);
      expect(response.body).toEqual({ data: { limit: 5 } });
    });

    it('rejects invalid input with VALIDATION_FAILED and field paths', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/test-conventions/page?limit=1000')
        .expect(400);
      const parsed = apiErrorSchema.parse(response.body);
      expect(parsed.error.code).toBe('VALIDATION_FAILED');
      expect(parsed.error.details?.[0]?.path).toBe('limit');
    });

    it('validates request bodies', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/test-conventions/echo')
        .send({ name: 'Pack A' })
        .expect(201);
      const bad = await request(app.getHttpServer())
        .post('/api/v1/test-conventions/echo')
        .send({ name: '' })
        .expect(400);
      expect(apiErrorSchema.parse(bad.body).error.code).toBe('VALIDATION_FAILED');
      await request(app.getHttpServer()).post('/api/v1/test-conventions/echo').send({}).expect(400);
    });

    it('answers malformed JSON with a 400 envelope, not a stack trace', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/test-conventions/echo')
        .set('content-type', 'application/json')
        .send('{"name": ');
      expect(response.status).toBe(400);
      expect(apiErrorSchema.safeParse(response.body).success).toBe(true);
      expect(JSON.stringify(response.body)).not.toContain('node_modules');
    });

    it('rejects oversized bodies with 413', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/test-conventions/echo')
        .send({ name: 'x'.repeat(1_100_000) });
      expect(response.status).toBe(413);
      expect(apiErrorSchema.parse(response.body).error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('turns an unexpected exception into a 500 envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/test-conventions/boom')
        .expect(500);
      expect(apiErrorSchema.parse(response.body).error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('request ids', () => {
    it('generates an id and echoes it in header and error body', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
      const id = response.headers['x-request-id'];
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(apiErrorSchema.parse(response.body).error.requestId).toBe(id);
    });

    it('keeps a well-formed caller id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('x-request-id', 'client-trace-12345');
      expect(response.headers['x-request-id']).toBe('client-trace-12345');
    });

    it('replaces a malformed caller id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('x-request-id', '<b>bad id</b>');
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('security headers', () => {
    it('sets a locked-down header set on API responses', async () => {
      const { headers } = await request(app.getHttpServer()).get('/api/v1/health');
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['content-security-policy']).toContain("default-src 'none'");
      expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(headers['referrer-policy']).toBe('no-referrer');
      expect(headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(headers['x-powered-by']).toBeUndefined();
    });

    it('does not send HSTS outside production', async () => {
      const { headers } = await request(app.getHttpServer()).get('/api/v1/health');
      expect(headers['strict-transport-security']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows a configured origin', async () => {
      const { headers } = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('origin', 'http://localhost:3000');
      expect(headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('does not allow an unlisted origin', async () => {
      const { headers } = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('origin', 'https://evil.example');
      expect(headers['access-control-allow-origin']).toBeUndefined();
    });

    it('answers preflight for a configured origin and exposes the request id', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/health')
        .set('origin', 'http://localhost:3000')
        .set('access-control-request-method', 'GET');
      expect(response.status).toBeLessThan(300);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-expose-headers']).toContain('x-request-id');
    });

    it('does not enable credentialed requests yet', async () => {
      const { headers } = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('origin', 'http://localhost:3000');
      expect(headers['access-control-allow-credentials']).toBeUndefined();
    });
  });

  describe('API documentation', () => {
    it('serves the OpenAPI document describing the health endpoint', async () => {
      const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
      const document = openApiDocument.parse(response.body);
      expect(document.openapi).toMatch(/^3\./);
      expect(Object.keys(document.paths)).toContain('/api/v1/health');
      const health = document.paths['/api/v1/health']?.get;
      expect(Object.keys(health?.responses ?? {})).toEqual(expect.arrayContaining(['200', '503']));
    });

    it('serves the Swagger UI page', async () => {
      const response = await request(app.getHttpServer()).get('/api/docs').redirects(1);
      expect(response.status).toBe(200);
      expect(response.text).toContain('swagger');
    });
  });
});

describe('HTTP conventions (production configuration)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await migrateTestDatabase();
    app = await createTestApp(
      testConfig({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://app.example.com',
        DATABASE_SSL: 'disable',
      }),
      [ConventionsTestController],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('hides internal error details from the client', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/test-conventions/boom')
      .expect(500);
    expect(apiErrorSchema.parse(response.body).error.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });

  it('sends HSTS', async () => {
    const { headers } = await request(app.getHttpServer()).get('/api/v1/health');
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
  });

  it('does not publish API documentation unless explicitly enabled', async () => {
    await request(app.getHttpServer()).get('/api/docs-json').expect(404);
    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });

  it('allows only the configured production origin', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('origin', 'https://app.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');
    const denied = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('origin', 'http://localhost:3000');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
