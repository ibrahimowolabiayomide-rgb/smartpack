import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/** What the audit trail and rate limits need to know about a request. Never includes secrets. */
export interface RequestContext {
  requestId: string;
  /** Client address as resolved by Fastify (honours TRUST_PROXY_HOPS). */
  ip: string;
  userAgent: string | null;
}

const USER_AGENT_MAX = 255;

export function contextOf(request: FastifyRequest): RequestContext {
  const agent = request.headers['user-agent'];
  return {
    requestId: request.id,
    ip: request.ip,
    userAgent: typeof agent === 'string' ? agent.slice(0, USER_AGENT_MAX) : null,
  };
}

/** Injects the {@link RequestContext} of the current request into a handler parameter. */
export const Ctx = createParamDecorator((_data: unknown, host: ExecutionContext): RequestContext =>
  contextOf(host.switchToHttp().getRequest<FastifyRequest>()),
);
