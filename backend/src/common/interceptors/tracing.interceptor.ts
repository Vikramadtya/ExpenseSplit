import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { trace, context as otelContext } from '@opentelemetry/api';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const { method, originalUrl } = req;
    const reqId = String(req.headers['x-request-id'] ?? '');
    const spanContext = trace.getSpan(otelContext.active())?.spanContext();
    const traceId = spanContext?.traceId || reqId;
    const userAgent = req.get('user-agent') || '';
    const ip = req.ip;

    const startTime = Date.now();

    this.logger.log(`[REQ] ${method} ${originalUrl} - Trace: ${traceId} - ${ip} - ${userAgent}`);

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const { statusCode } = res;
        this.logger.log(
          `[RES] ${method} ${originalUrl} ${statusCode} - ${duration}ms - Trace: ${traceId}`,
        );
      }),
    );
  }
}
