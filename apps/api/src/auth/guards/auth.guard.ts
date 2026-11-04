import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../decorators.js';
import { SessionsService } from '../sessions.service.js';

/**
 * Deny by default: every route requires a valid session unless it is marked @Public().
 * Attaches the caller's {@link AuthContext} to the request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const token = this.sessions.tokenFrom(request.cookies);
    const auth = token ? await this.sessions.authenticate(token) : null;
    if (!auth) {
      // A stale cookie is useless; remove it so the browser stops sending it.
      if (request.cookies && token) this.sessions.clearCookie(http.getResponse<FastifyReply>());
      throw new UnauthorizedException('Authentication required.');
    }
    request.auth = auth;
    return true;
  }
}
