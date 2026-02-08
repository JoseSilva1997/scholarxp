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
import { MailDeliveryError } from '../../mailer/mailer.service';

type RequestWithId = Request & {
  requestId?: string;
};

type SafeErrorDetail = {
  field?: string;
  message: string;
};

type SafeErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  details?: SafeErrorDetail[];
};

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  // ANSI colors make critical server failures stand out quickly in plain-text logs.
  private static readonly RED = '\x1b[31m';
  private static readonly RESET = '\x1b[0m';

  // Keep a dedicated logger scope so filter logs stay grouped in output.
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    // Nest's HTTP adapter returns loosely typed values, so we narrow safely through unknown first.
    const response = ctx.getResponse<unknown>() as Response;
    const request = ctx.getRequest<unknown>() as RequestWithId;
    const requestId = request.requestId ?? 'unknown';

    const isHttp = exception instanceof HttpException;
    const isCsrfError = exception === invalidCsrfTokenError;
    const isMailDeliveryError = exception instanceof MailDeliveryError;
    // Mail delivery errors are expected failures; return 500 to let client know but defer retry to them.
    const status = isHttp
      ? exception.getStatus()
      : isCsrfError
        ? HttpStatus.FORBIDDEN
        : isMailDeliveryError
          ? HttpStatus.INTERNAL_SERVER_ERROR
          : HttpStatus.INTERNAL_SERVER_ERROR;

    // Always log the detailed error server-side to aid debugging.
    const message = isHttp
      ? exception.message
      : isCsrfError
        ? 'Invalid CSRF token'
        : isMailDeliveryError
          ? `Mail delivery failed: ${exception.reason}`
          : 'Unhandled exception';
    const stack =
      exception instanceof Error && exception.stack
        ? exception.stack
        : undefined;
    const logLine = `${request?.method ?? 'UNKNOWN'} ${request?.url ?? 'UNKNOWN'} -> ${status}: ${message} requestId=${requestId}`;
    
    // Mail delivery errors are logged as warnings since they're expected failures; other 5xx as error with stack.
    if (isMailDeliveryError) {
      this.logger.warn('Email service failure', {
        reason: exception.reason,
        details: exception.details,
        requestId,
      });
    } else if (status >= 500) {
      this.logger.error(
        `${SafeExceptionFilter.RED}${logLine}${SafeExceptionFilter.RESET}`,
        stack,
      );
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
      // Normalize HttpException payloads so clients can parse consistently without leaking internals.
      const safeResponse = this.buildSafeHttpResponse(
        exception,
        status,
        requestId,
      );
      response.status(status).json(safeResponse);
      return;
    }

    const safeResponse: SafeErrorResponse = isCsrfError
      ? {
          statusCode: 403,
          code: 'CSRF_TOKEN_INVALID',
          message: 'Your session expired. Please refresh and try again.',
          requestId,
        }
      : isMailDeliveryError
        ? {
            statusCode: 500,
            code: 'EMAIL_DELIVERY_FAILED',
            message: 'Failed to send email. Please try again later.',
            requestId,
          }
        : {
            statusCode: 500,
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong. Please try again.',
            requestId,
          };

    // For unexpected errors, return a safe and stable payload contract to clients.
    response.status(status).json(safeResponse);
  }

  private buildSafeHttpResponse(
    exception: HttpException,
    status: number,
    requestId: string,
  ): SafeErrorResponse {
    const raw = exception.getResponse();
    let code = this.getCodeFromStatus(status);
    let message = this.getDefaultMessageForStatus(status);
    let details: SafeErrorDetail[] | undefined;

    if (typeof raw === 'string') {
      message = raw;
    } else if (this.isRecord(raw)) {
      // Respect explicit safe code/message when route code intentionally set one.
      if (typeof raw.code === 'string' && raw.code.trim()) {
        code = raw.code;
      }

      if (typeof raw.message === 'string' && raw.message.trim()) {
        message = raw.message;
      } else if (Array.isArray(raw.message)) {
        // Class-validator returns an array in BadRequestException; expose only normalized text.
        const validationMessages = raw.message.filter(
          (entry): entry is string =>
            typeof entry === 'string' && entry.trim().length > 0,
        );
        if (validationMessages.length > 0) {
          message = 'Validation failed. Please review your input.';
          details = validationMessages.map((entry) => ({ message: entry }));
          if (status === 400) {
            code = 'VALIDATION_ERROR';
          }
        }
      } else if (typeof raw.error === 'string' && raw.error.trim()) {
        message = raw.error;
      }

      const structuredDetails = this.normalizeDetails(raw.details);
      if (structuredDetails && structuredDetails.length > 0) {
        details = structuredDetails;
      }
    }

    return {
      statusCode: status,
      code,
      message,
      requestId,
      ...(details && details.length > 0 ? { details } : {}),
    };
  }

  private normalizeDetails(value: unknown): SafeErrorDetail[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const details = value
      .map((entry): SafeErrorDetail | null => {
        if (typeof entry === 'string') {
          return entry.trim().length > 0 ? { message: entry } : null;
        }
        if (!this.isRecord(entry)) {
          return null;
        }
        if (
          typeof entry.message !== 'string' ||
          entry.message.trim().length === 0
        ) {
          return null;
        }
        return {
          message: entry.message,
          ...(typeof entry.field === 'string' && entry.field.trim().length > 0
            ? { field: entry.field }
            : {}),
        };
      })
      .filter((entry): entry is SafeErrorDetail => entry !== null);

    return details.length > 0 ? details : undefined;
  }

  private getDefaultMessageForStatus(status: number): string {
    if (status >= 500) {
      return 'Something went wrong. Please try again.';
    }
    return 'The request could not be completed.';
  }

  private getCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      case 429:
        return 'TOO_MANY_REQUESTS';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : `HTTP_${status}_ERROR`;
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
