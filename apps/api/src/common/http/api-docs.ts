import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  type SchemaObject,
} from '@nestjs/swagger';
import { apiErrorSchema, apiSuccessSchema } from '@smartpack/shared';
import { z } from 'zod';

const ERROR_TEXT: Record<number, string> = {
  400: 'Validation failed or the one-time link is invalid.',
  401: 'No valid session.',
  403: 'Authenticated, but not permitted.',
  404: 'Not found (also returned for records of another company).',
  409: 'Conflicts with the current state.',
  413: 'Request body too large.',
  415: 'Content type is not application/json.',
  429: 'Rate limit reached; see the Retry-After header.',
};

function schemaOf(schema: z.ZodType, io: 'input' | 'output'): SchemaObject {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io }) as unknown as SchemaObject;
}

export interface ApiEndpointOptions {
  summary: string;
  description?: string;
  /** `public` routes need no session; otherwise the session cookie is required. */
  access: 'public' | 'authenticated' | { permission: string };
  request?: z.ZodType;
  /** Payload type inside the `{ data }` envelope. */
  response?: z.ZodType;
  status?: number;
  errors?: number[];
}

/**
 * One decorator for the documentation every endpoint needs: what it does, who may call it, what
 * it accepts and returns (derived from the same Zod schemas that validate it), and which error
 * statuses it can produce. Keeps docs and behaviour from drifting.
 */
export function ApiEndpoint(options: ApiEndpointOptions) {
  const status = options.status ?? 200;
  const accessText =
    options.access === 'public'
      ? 'Public (no session).'
      : options.access === 'authenticated'
        ? 'Requires a session.'
        : `Requires a session and the permission \`${options.access.permission}\`.`;
  const decorators = [
    ApiOperation({
      summary: options.summary,
      description: [options.description, `**Access:** ${accessText}`].filter(Boolean).join('\n\n'),
    }),
    ApiResponse({
      status,
      description: 'Success',
      schema: options.response ? schemaOf(apiSuccessSchema(options.response), 'output') : undefined,
    }),
  ];
  if (options.access !== 'public') decorators.push(ApiCookieAuth());
  if (options.request) decorators.push(ApiBody({ schema: schemaOf(options.request, 'input') }));

  const errors = new Set(options.errors ?? []);
  if (options.access !== 'public') errors.add(401);
  if (typeof options.access === 'object') errors.add(403);
  errors.add(429);
  for (const code of errors) {
    decorators.push(
      ApiResponse({
        status: code,
        description: ERROR_TEXT[code] ?? 'Error',
        schema: schemaOf(apiErrorSchema, 'output'),
      }),
    );
  }
  return applyDecorators(...decorators);
}
