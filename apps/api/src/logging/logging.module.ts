import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.constants.js';

/** Strips the query string: it may carry tokens or personal data and must not reach logs. */
function pathOnly(url: string | undefined): string {
  if (url === undefined) return '';
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

/** The request shape pino-http hands to every callback below (Fastify sets `id` on it). */
interface LoggedRequest {
  id?: unknown;
  method?: string;
  url?: string;
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          // JSON lines in production (machine-parsable); readable output only in development.
          transport:
            config.env === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
              : undefined,
          // Fastify has already assigned and validated `req.id` (see request-id.ts).
          genReqId: (req: LoggedRequest) => String(req.id),
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            censor: '[redacted]',
          },
          serializers: {
            req: (req: LoggedRequest) => ({
              id: req.id,
              method: req.method,
              path: pathOnly(req.url),
            }),
            res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
            // pino-http invents an Error for every 5xx response, and its stack points into
            // pino-http itself. Real failures are logged with full detail by the exception
            // filter, so this entry keeps the message only.
            err: (err: { type?: string; message?: string }) => ({
              type: err.type,
              message: err.message,
            }),
          },
          // Orchestrators probe /health every few seconds; successful probes are noise.
          customLogLevel: (req: LoggedRequest, res: { statusCode: number }, error?: Error) => {
            if (error !== undefined || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return pathOnly(req.url).endsWith('/health') ? 'debug' : 'info';
          },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
