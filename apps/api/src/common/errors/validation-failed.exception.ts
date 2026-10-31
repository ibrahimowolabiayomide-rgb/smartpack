import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorDetail } from '@smartpack/shared';

/** Thrown by the global validation pipe when request input does not match its schema. */
export class ValidationFailedException extends HttpException {
  constructor(readonly details: ApiErrorDetail[]) {
    super('Request validation failed.', HttpStatus.BAD_REQUEST);
  }
}
