import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/** Structured access log with a request id, and no request bodies (they hold secrets). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthenticatedUser; requestId?: string }>();
    const response = http.getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.write(request, response.statusCode, startedAt, requestId),
        error: (error: { status?: number }) =>
          this.write(request, error?.status ?? 500, startedAt, requestId),
      }),
    );
  }

  private write(
    request: Request & { user?: AuthenticatedUser },
    status: number,
    startedAt: number,
    requestId: string,
  ) {
    this.logger.log(
      JSON.stringify({
        requestId,
        method: request.method,
        path: request.originalUrl?.split('?')[0],
        status,
        durationMs: Date.now() - startedAt,
        userId: request.user?.id ?? null,
      }),
    );
  }
}
