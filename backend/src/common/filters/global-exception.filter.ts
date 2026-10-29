import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const reqId = String(request.headers['x-request-id'] || 'unknown');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let errorResponse: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      errorResponse = exception.getResponse();
      message =
        typeof errorResponse === 'string' ? errorResponse : errorResponse.message || errorResponse;
    } else if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      errorResponse = (exception as any).getZodError().errors;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const logPayload = {
      reqId,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      status,
      message,
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error(
        `[ERR] ${status} - ${request.method} ${request.url} - ${reqId}\n${JSON.stringify(logPayload, null, 2)}`,
      );
    } else {
      this.logger.warn(
        `[WARN] ${status} - ${request.method} ${request.url} - ${reqId} - ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: logPayload.timestamp,
      path: request.url,
      message: message,
      requestId: reqId,
      details: status === 400 && errorResponse ? errorResponse : undefined,
    });
  }
}
