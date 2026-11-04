import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { RateLimitedException } from '../../common/errors/domain.exception.js';
import type { RateLimitPolicy } from '../../security/rate-limiter.js';
import { RateLimiter } from '../../security/rate-limiter.js';
import { RATE_LIMIT_KEY } from '../decorators.js';

/** Applies the per-address policy named by @RateLimit(). Per-account policies live in services. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!policy) return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const outcome = this.limiter.consume(policy, request.ip);
    if (!outcome.allowed) throw new RateLimitedException(outcome.retryAfterSeconds);
    return true;
  }
}
