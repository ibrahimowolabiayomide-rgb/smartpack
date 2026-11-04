import { HttpException } from '@nestjs/common';
import type { ApiErrorCode } from '@smartpack/shared';

/**
 * A business-rule failure with an explicit machine-readable code. Use the standard Nest
 * exceptions (ForbiddenException, NotFoundException, ConflictException) when their built-in code
 * says enough; use this when clients must branch on a more specific code.
 */
export class DomainException extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    status: number,
  ) {
    super(message, status);
  }
}

export const invalidCredentials = () =>
  new DomainException('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);

export const invalidToken = () =>
  new DomainException(
    'INVALID_TOKEN',
    'This link is invalid, has expired or was already used.',
    400,
  );

export class RateLimitedException extends DomainException {
  constructor(readonly retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Too many attempts. Try again later.', 429);
  }
}
