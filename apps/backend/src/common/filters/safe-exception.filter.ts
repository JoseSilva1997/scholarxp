// Global exception filter that standardizes error responses and logs full details server-side.
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  // Keep a dedicated logger scope so filter logs stay grouped in output.
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Always log the detailed error server-side to aid debugging.
    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Unhandled exception';
    const stack =
      exception instanceof Error && exception.stack
        ? exception.stack
        : undefined;
    this.logger.error(
      `${request?.method ?? 'UNKNOWN'} ${request?.url ?? 'UNKNOWN'} -> ${status}: ${message}`,
      stack,
    );

    // Return a safe, minimal payload to clients; avoid leaking internal details.
    response.status(status).json({
      message: 'Something went wrong. Please try again.',
    });
  }
}
