import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { ValidationFailedException } from './errors/validation-failed.exception.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor.js';

function pathOf(issue: StandardSchemaV1.Issue): string {
  return (issue.path ?? [])
    .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
    .join('.');
}

/**
 * Registers the API-wide conventions: input validation, the success envelope and the error
 * envelope. Providers registered with APP_* tokens apply to every route automatically,
 * including in test modules that import this module.
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    {
      // Validates any @Body/@Query/@Param declared with `{ schema }` (Zod implements
      // Standard Schema). Handlers without a schema are not validated by this pipe.
      provide: APP_PIPE,
      useValue: new StandardSchemaValidationPipe({
        exceptionFactory: (issues: readonly StandardSchemaV1.Issue[]) =>
          new ValidationFailedException(
            issues.map((issue) => ({ path: pathOf(issue), message: issue.message })),
          ),
      }),
    },
  ],
})
export class CommonModule {}
