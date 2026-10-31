import { Catch, Inject, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '../../config/app-config.js';
import { APP_CONFIG } from '../../config/config.constants.js';
import { mapException } from '../errors/map-exception.js';

/**
 * Last line of defence: every error leaves the API in the same envelope, and server-side
 * failures are logged with their full detail while the client sees only what is safe.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectPinoLogger(AllExceptionsFilter.name) private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const body = mapException(exception, {
      requestId: request.id,
      exposeInternalErrors: !this.config.isProduction,
    });

    if (body.error.statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId: request.id },
        'Unhandled error while handling request',
      );
    }

    void reply.status(body.error.statusCode).send(body);
  }
}
