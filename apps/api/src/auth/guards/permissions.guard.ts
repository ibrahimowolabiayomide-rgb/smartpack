import {
  ForbiddenException,
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PERMISSIONS_KEY } from '../decorators.js';

/** Enforces @RequirePermissions(). Runs after AuthGuard, so `request.auth` is set. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = request.auth;
    if (auth && required.every((permission) => auth.permissions.has(permission))) return true;

    this.logger.warn(
      `Authorization denied: user ${auth?.user.id ?? 'unknown'} lacks [${required.join(', ')}] on ${request.method} ${request.url.split('?')[0] ?? ''} (requestId ${request.id})`,
    );
    throw new ForbiddenException('You do not have permission to do this.');
  }
}
