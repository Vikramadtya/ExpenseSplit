import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const method = request.method;
    // No query string: it can carry one-time OAuth codes, emails and search terms.
    const url = String(request.originalUrl).split('?')[0];
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const delay = Date.now() - now;
          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${delay}ms - ${ip} - ${userAgent}`,
          );
        },
        error: (error) => {
          const delay = Date.now() - now;
          const status = error.getStatus ? error.getStatus() : 500;
          // The stack is logged by the exception filter (with the underlying database error).
          this.logger.error(`${method} ${url} ${status} - ${delay}ms - ${ip} - ${userAgent}`);
        },
      }),
    );
  }
}
