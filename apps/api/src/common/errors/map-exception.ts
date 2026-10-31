import { HttpException } from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@smartpack/shared';
import { ValidationFailedException } from './validation-failed.exception.js';

export interface MapContext {
  requestId: string;
  /** When false (production), 5xx responses carry a generic message only. */
  exposeInternalErrors: boolean;
}

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

const GENERIC_MESSAGE: Partial<Record<ApiErrorCode, string>> = {
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
};

export function errorCodeForStatus(status: number): ApiErrorCode {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}

function messageFromHttpException(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String).join('; ');
  return exception.message;
}

/** Fastify raises plain errors with a numeric statusCode (body too large, bad JSON, ...). */
function clientStatusOf(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const status = (exception as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

/**
 * Converts any thrown value into the standard error envelope.
 * Pure function so every branch can be unit-tested without a running server.
 */
export function mapException(exception: unknown, context: MapContext): ApiError {
  const { requestId, exposeInternalErrors } = context;

  if (exception instanceof ValidationFailedException) {
    return {
      error: {
        code: 'VALIDATION_FAILED',
        message: exception.message,
        statusCode: 400,
        requestId,
        details: exception.details,
      },
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const code = errorCodeForStatus(statusCode);
    const hide = statusCode >= 500 && !exposeInternalErrors;
    return {
      error: {
        code,
        message: hide
          ? (GENERIC_MESSAGE[code] ?? 'An unexpected error occurred.')
          : messageFromHttpException(exception),
        statusCode,
        requestId,
      },
    };
  }

  const clientStatus = clientStatusOf(exception);
  if (clientStatus !== undefined) {
    return {
      error: {
        code: errorCodeForStatus(clientStatus),
        message: exception instanceof Error ? exception.message : 'Bad request.',
        statusCode: clientStatus,
        requestId,
      },
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message:
        exposeInternalErrors && exception instanceof Error
          ? exception.message
          : 'An unexpected error occurred.',
      statusCode: 500,
      requestId,
    },
  };
}
