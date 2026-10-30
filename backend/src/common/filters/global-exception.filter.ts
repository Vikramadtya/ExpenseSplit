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
import { describeCauses, redactParams } from './error-details';

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

    // Never log the query string (OAuth codes, emails) and never send internals to the client.
    const path = request.path;
    const loggedMessage = typeof message === 'string' ? redactParams(message) : message;

    const logPayload = {
      reqId,
      timestamp: new Date().toISOString(),
      path,
      method: request.method,
      status,
      message: loggedMessage,
      // The database's own error (code, detail, hint) sits behind the "Failed query" wrapper.
      causes: exception instanceof Error ? describeCauses(exception) : undefined,
      stack: exception instanceof Error ? redactParams(exception.stack ?? '') : undefined,
    };

    if (status >= 500) {
      this.logger.error(
        `[ERR] ${status} - ${request.method} ${path} - ${reqId}\n${JSON.stringify(logPayload, null, 2)}`,
      );
    } else {
      this.logger.warn(
        `[WARN] ${status} - ${request.method} ${path} - ${reqId} - ${JSON.stringify(loggedMessage)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: logPayload.timestamp,
      path,
      // Internal errors say nothing about the cause; the request id finds it in the server log.
      message: status >= 500 ? 'Internal server error' : message,
      requestId: reqId,
      details: status === 400 && errorResponse ? errorResponse : undefined,
    });
  }
}
