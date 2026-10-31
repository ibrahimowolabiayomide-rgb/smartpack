import { z } from 'zod';

/**
 * Success envelope used by every JSON endpoint: `{ "data": <payload> }`.
 *
 * A fixed top-level key leaves room for `meta` (pagination, etc.) later
 * without a breaking change for clients.
 */
export function apiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.object({ data });
}

export type ApiSuccess<T> = { data: T };

/**
 * Machine-readable error codes. Clients branch on `code`, never on `message`,
 * which is for humans and may change.
 */
export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorDetailSchema = z.object({
  /** Dotted path to the offending input, e.g. `body.email`. Empty for the whole input. */
  path: z.string(),
  message: z.string(),
});

export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;

/** Error envelope used by every non-2xx JSON response: `{ "error": { ... } }`. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    statusCode: z.number().int().min(400).max(599),
    /** Echoes the `x-request-id` header so a user report can be matched to server logs. */
    requestId: z.string(),
    details: z.array(apiErrorDetailSchema).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
