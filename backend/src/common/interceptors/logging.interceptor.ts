import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

/** One log line per HTTP request with a correlation id, echoed back on the `x-request-id` header. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly log = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('x-request-id', requestId);
    const started = Date.now();
    const line = (status: number) => `${req.method} ${req.originalUrl} ${status} ${Date.now() - started}ms [${requestId}]`;
    return next.handle().pipe(
      tap({
        next: () => this.log.log(line(res.statusCode)),
        error: (err: { status?: number }) => this.log.warn(line(err?.status ?? 500)),
      }),
    );
  }
}
