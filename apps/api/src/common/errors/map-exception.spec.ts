import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { apiErrorSchema } from '@smartpack/shared';
import { errorCodeForStatus, mapException } from './map-exception.js';
import { ValidationFailedException } from './validation-failed.exception.js';

const dev = { requestId: 'req-0001', exposeInternalErrors: true };
const prod = { requestId: 'req-0001', exposeInternalErrors: false };

describe('mapException', () => {
  it('maps validation failures to 400 with per-field details', () => {
    const body = mapException(
      new ValidationFailedException([{ path: 'limit', message: 'Too big' }]),
      prod,
    );
    expect(body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      details: [{ path: 'limit', message: 'Too big' }],
    });
  });

  it('maps framework HTTP exceptions to their status and code', () => {
    expect(mapException(new NotFoundException('Cannot GET /x'), prod).error).toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'Cannot GET /x',
    });
    expect(mapException(new ForbiddenException(), prod).error.code).toBe('FORBIDDEN');
  });

  it('joins array messages', () => {
    const body = mapException(new BadRequestException(['a is required', 'b is invalid']), prod);
    expect(body.error.message).toBe('a is required; b is invalid');
  });

  it('keeps 4xx messages in production because they describe the caller’s own mistake', () => {
    expect(mapException(new NotFoundException('Cannot GET /nope'), prod).error.message).toBe(
      'Cannot GET /nope',
    );
  });

  it('hides the message of a 5xx HttpException in production', () => {
    const body = mapException(
      new InternalServerErrorException('connection to 10.0.0.5 refused'),
      prod,
    );
    expect(body.error.statusCode).toBe(500);
    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  it('hides a 503 message in production but keeps the status', () => {
    const body = mapException(new ServiceUnavailableException('pool exhausted'), prod);
    expect(body.error).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
      message: 'The service is temporarily unavailable.',
    });
  });

  it('shows the 5xx message outside production to help debugging', () => {
    expect(
      mapException(new InternalServerErrorException('pool exhausted'), dev).error.message,
    ).toBe('pool exhausted');
  });

  it('maps Fastify-style client errors by their statusCode', () => {
    const tooLarge = Object.assign(new Error('Request body is too large'), { statusCode: 413 });
    expect(mapException(tooLarge, prod).error).toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      statusCode: 413,
    });
  });

  it('treats an unknown thrown value as a generic 500 in production', () => {
    const secret = new Error('password=hunter2 rejected by db.internal');
    const body = mapException(secret, prod);
    expect(body.error).toMatchObject({ code: 'INTERNAL_ERROR', statusCode: 500 });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('does not leak a thrown string or object in production either', () => {
    expect(JSON.stringify(mapException('raw secret string', prod))).not.toContain('raw secret');
    expect(JSON.stringify(mapException({ secret: 'x' }, prod))).not.toContain('secret');
  });

  it('exposes the message of an unknown error outside production', () => {
    expect(mapException(new Error('kaboom'), dev).error.message).toBe('kaboom');
  });

  it('does not treat a stray ZodError as a client mistake', () => {
    // A ZodError escaping a handler means the server built bad data: that is a 500, not a 400.
    const zodLike = Object.assign(new Error('Invalid input'), { name: 'ZodError', issues: [] });
    expect(mapException(zodLike, prod).error.statusCode).toBe(500);
  });

  it('echoes the request id on every response', () => {
    expect(mapException(new Error('x'), prod).error.requestId).toBe('req-0001');
  });

  it('always produces a body that satisfies the shared error contract', () => {
    const inputs: unknown[] = [
      new ValidationFailedException([]),
      new NotFoundException(),
      new HttpException('teapot', 418),
      new InternalServerErrorException(),
      new Error('x'),
      'string',
      null,
      undefined,
    ];
    for (const input of inputs) {
      expect(apiErrorSchema.safeParse(mapException(input, prod)).success).toBe(true);
    }
  });
});

describe('errorCodeForStatus', () => {
  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [404, 'NOT_FOUND'],
    [429, 'RATE_LIMITED'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
    [502, 'INTERNAL_ERROR'],
    [418, 'BAD_REQUEST'],
  ])('maps %i to %s', (status, code) => {
    expect(errorCodeForStatus(status)).toBe(code);
  });
});
