import type { IncomingMessage } from 'node:http';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import type { AppConfig } from './config/app-config.js';
import { API_DOCS_PATH, API_PREFIX } from './config/app-info.js';
import { REQUEST_ID_HEADER, resolveRequestId } from './common/request-id.js';

/** 1 MiB. Photo upload endpoints, when they exist, will set their own explicit limit. */
const BODY_LIMIT_BYTES = 1_048_576;

/**
 * Swagger UI ships inline styles and scripts, so documentation routes need a looser policy
 * than the JSON API. Applied to the docs path only; every other response keeps the strict one.
 */
const DOCS_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "frame-ancestors 'none'",
].join('; ');

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    // Request logging is done by nestjs-pino; Fastify's own logger stays off.
    logger: false,
    bodyLimit: BODY_LIMIT_BYTES,
    // Ids are produced only by our validator, never taken from the header verbatim.
    requestIdHeader: false,
    genReqId: (request: IncomingMessage) => resolveRequestId(request.headers[REQUEST_ID_HEADER]),
  });
}

/**
 * Everything that must be identical in production and in tests: prefix, security headers,
 * CORS, request-id echo and API documentation. Call before `app.init()` / `app.listen()`.
 */
export async function configureApp(app: NestFastifyApplication, config: AppConfig): Promise<void> {
  app.setGlobalPrefix(API_PREFIX);

  await app.register(helmet, {
    // This service returns JSON only: it never needs to load or embed anything.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    // HSTS over plain-HTTP development would be ignored by browsers and misleading.
    strictTransportSecurity: config.isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: 'no-referrer' },
  });

  app.enableCors({
    origin: config.cors.allowedOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    // Credentialed (cookie) requests are decided together with authentication, not before.
    credentials: false,
    maxAge: 600,
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', (request, reply, payload, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    if (config.docs.enabled && request.url.startsWith(`/${API_DOCS_PATH}`)) {
      void reply.header('content-security-policy', DOCS_CONTENT_SECURITY_POLICY);
    }
    done(null, payload);
  });

  if (config.docs.enabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SmartPack API')
        .setDescription(
          'REST API for the SmartPack Asset Intelligence Platform. ' +
            'Only the health endpoint is implemented; business modules are not implemented yet.',
        )
        .setVersion(config.version)
        .build(),
    );
    SwaggerModule.setup(API_DOCS_PATH, app, document, {
      useGlobalPrefix: false,
      jsonDocumentUrl: `${API_DOCS_PATH}-json`,
    });
  }

  app.enableShutdownHooks();
}
