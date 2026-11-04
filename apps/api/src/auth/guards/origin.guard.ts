import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../../config/app-config.js';
import { APP_CONFIG } from '../../config/config.constants.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests. A state-changing request that carries the
 * session cookie must come from a page on an allowed origin: the browser sets `Origin` (or at
 * least `Referer`) itself and a cross-site attacker cannot forge it. Combined with the SameSite=Lax
 * cookie, a malicious site can neither send the cookie on a POST nor pass this check.
 *
 * Requests without the session cookie (sign-in, password reset, invitation acceptance) are not
 * cookie-authenticated, so they are not CSRF targets and are not blocked here.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly logger = new Logger(OriginGuard.name);
  private readonly allowed: Set<string>;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.allowed = new Set(config.cors.allowedOrigins);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (request.cookies?.[this.config.auth.cookieName] === undefined) return true;

    const origin = request.headers.origin;
    const source = typeof origin === 'string' ? origin : originOfReferer(request.headers.referer);
    if (source !== undefined && this.allowed.has(source)) return true;

    this.logger.warn(
      `Blocked cookie-authenticated ${request.method} from origin "${source ?? 'none'}" (requestId ${request.id})`,
    );
    throw new ForbiddenException('The request origin is not allowed.');
  }
}

function originOfReferer(referer: string | string[] | undefined): string | undefined {
  if (typeof referer !== 'string') return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
