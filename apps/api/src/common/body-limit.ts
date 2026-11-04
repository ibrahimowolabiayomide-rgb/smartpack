import { Logger, PayloadTooLargeException } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config/app-config.js';
import { mapException } from './errors/map-exception.js';

/** 1 MiB. Upload endpoints, when they exist, set their own explicit per-route limit. */
export const BODY_LIMIT_BYTES = 1_048_576;

/**
 * Largest oversized body the server is willing to read and throw away so that the client can
 * finish its upload and read the 413. Beyond this the connection is closed immediately.
 */
export const MAX_DISCARDED_BODY_BYTES = 16 * 1_048_576;

/** Returns the declared Content-Length, or undefined when absent or not a plain integer. */
export function declaredContentLength(header: string | string[] | undefined): number | undefined {
  if (typeof header !== 'string' || !/^\d{1,15}$/.test(header)) return undefined;
  return Number(header);
}

/**
 * Rejects a request whose declared Content-Length exceeds the route's body limit, before any of
 * the body is read.
 *
 * Why this exists: Fastify's own check answers 413 with `Connection: close`, and Node then
 * destroys the socket while the client is still sending. Closing a TCP connection that has unread
 * incoming bytes makes the operating system send a reset, and a reset can reach the client before
 * (or instead of) the 413 it was just sent. The client then reports ECONNRESET/EPIPE rather than
 * "payload too large". The outcome depends on timing and platform (Windows discards a response
 * that was received just before the reset), so a test or a browser upload fails intermittently.
 *
 * Here the 413 is sent without `Connection: close`: Node reads and discards the rest of the body
 * (bounded by MAX_DISCARDED_BODY_BYTES) and the connection closes cleanly, or is reused.
 * Bodies without a Content-Length (chunked) still take Fastify's streaming limit and close path.
 */
export function registerBodyLimitGuard(fastify: FastifyInstance, config: AppConfig): void {
  const logger = new Logger('BodyLimit');
  fastify.addHook('onRequest', async (request, reply) => {
    const declared = declaredContentLength(request.headers['content-length']);
    if (declared === undefined) return;
    const limit = request.routeOptions.bodyLimit ?? BODY_LIMIT_BYTES;
    if (declared <= limit) return;

    logger.warn(
      `Rejected oversized request body: ${declared} bytes declared, limit ${limit} (requestId ${request.id})`,
    );
    if (declared > MAX_DISCARDED_BODY_BYTES) void reply.header('connection', 'close');
    const body = mapException(
      new PayloadTooLargeException('The request body exceeds the allowed size.'),
      { requestId: request.id, exposeInternalErrors: !config.isProduction },
    );
    return reply.code(413).send(body);
  });
}
