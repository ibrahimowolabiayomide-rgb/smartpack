import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { ApiSuccess } from '@smartpack/shared';
import { map, type Observable } from 'rxjs';

/** Wraps every successful handler result in `{ data }`, the API's success envelope. */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
