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
import { generateToken, invalidCsrfTokenError } from '../security/csrf';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  // Keep a dedicated logger scope so filter logs stay grouped in output.
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const isCsrfError = exception === invalidCsrfTokenError;
    const status = isHttp
      ? exception.getStatus()
      : isCsrfError
        ? HttpStatus.FORBIDDEN
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Always log the detailed error server-side to aid debugging.
    const message = isHttp
      ? exception.message
      : isCsrfError
        ? 'Invalid CSRF token'
        : 'Unhandled exception';
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

    // If the CSRF token was invalid, issue a fresh one so the client can recover on the next attempt.
    if (isCsrfError) {
      try {
        const nextToken = generateToken(request);
        response.setHeader('x-csrf-token', nextToken);
      } catch {
        // Swallow token regeneration errors; we still return a sanitized 403 response.
      }
    }

    if (isHttp) {
      // For expected/handled errors, forward the original payload so clients can show specific messages.
      const httpResponse = exception.getResponse();
      response.status(status).json(httpResponse);
      return;
    }

    // For unexpected errors, return a safe, minimal payload to clients.
    response.status(status).json({
      // Keep user-facing copy friendly; CSRF rejections are typically caused by stale sessions.
      message: isCsrfError
        ? 'Your session expired. Please refresh and try again.'
        : 'Something went wrong. Please try again.',
    });
  }
}
