import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred.';
    let type = 'https://expensesplit.app/errors/internal-server-error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      title = exception.name;
      detail = typeof res === 'string' ? res : res.message || res.error || detail;
      type = `https://expensesplit.app/errors/${status}`;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      title = 'Validation Error';
      detail = (exception as any).errors
        .map((e: any) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      type = 'https://expensesplit.app/errors/validation-error';
    }

    const problemDetail = {
      type,
      title,
      status,
      detail,
      instance: request.url,
      requestId: (request as any).id || 'unknown',
      // traceId: (request as any).traceId || 'unknown', // Set by tracing interceptor
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status} - ${detail}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - ${status} - ${detail}`);
    }

    response.status(status).json(problemDetail);
  }
}
