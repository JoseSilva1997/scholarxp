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

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Always log the detailed error server-side to aid debugging.
    const message = isHttp ? exception.message : 'Unhandled exception';
    const stack =
      exception instanceof Error && exception.stack
        ? exception.stack
        : undefined;
    const logLine = `${request?.method ?? 'UNKNOWN'} ${request?.url ?? 'UNKNOWN'} -> ${status}: ${message}`;
    // Validation and other 4xx flows are expected; keep them at warn to reduce noise.
    if (status >= 500) {
      this.logger.error(logLine, stack);
    } else {
      this.logger.warn(logLine);
    }

    if (isHttp) {
      // For expected/handled errors, forward the original payload so clients can show specific messages.
      const httpResponse = exception.getResponse();
      response.status(status).json(httpResponse);
      return;
    }

    // For unexpected errors, return a safe, minimal payload to clients.
    response.status(status).json({
      message: 'Something went wrong. Please try again.',
    });
  }
}
