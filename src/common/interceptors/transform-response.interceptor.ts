import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Paginated } from '../dto/api-response.dto';

/**
 * Wraps every controller return value in the documented envelope:
 *   { success: true, data, meta? }
 * A `Paginated` return value is unwrapped into `data` + `meta`.
 */
@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (payload instanceof Paginated) {
          return { success: true, data: payload.items, meta: payload.meta };
        }
        // Health probes and redirects return raw bodies.
        if (payload === undefined || payload === null) {
          return { success: true, data: null };
        }
        return { success: true, data: payload };
      }),
    );
  }
}
