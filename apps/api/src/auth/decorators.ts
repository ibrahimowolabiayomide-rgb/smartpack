import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { PermissionKey } from '@smartpack/shared';
import type { FastifyRequest } from 'fastify';
import type { RateLimitPolicy } from '../security/rate-limiter.js';
import type { AuthContext } from './auth-context.js';

export const IS_PUBLIC_KEY = 'smartpack:public';
export const PERMISSIONS_KEY = 'smartpack:permissions';
export const RATE_LIMIT_KEY = 'smartpack:rate-limit';

/**
 * Marks a route as reachable without a session. Everything else is protected by default, so a
 * forgotten decorator fails closed. Every use of this decorator is listed in docs/API.md and
 * checked by a test.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** The caller must hold ALL listed permissions. Without this decorator any signed-in user passes. */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Limits requests per client address using the named policy (see security/rate-limiter.ts). */
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_KEY, policy);

/** Injects the authenticated {@link AuthContext}. Only valid on protected routes. */
export const Auth = createParamDecorator((_data: unknown, host: ExecutionContext): AuthContext => {
  const auth = host.switchToHttp().getRequest<FastifyRequest>().auth;
  // Reaching a handler without auth means the guard was bypassed: fail closed.
  if (!auth) throw new UnauthorizedException('Authentication required.');
  return auth;
});
