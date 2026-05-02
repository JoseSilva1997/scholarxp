// Logs request lifecycle metadata centrally so route handlers remain focused on business logic.
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap } from 'rxjs/operators';

type RequestWithMeta = Request & {
  requestId?: string;
  user?: {
    id?: number;
  };
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  // Keep a dedicated logger scope to simplify filtering in container logs.
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  // Wraps each HTTP handler invocation, recording a single structured log line
  // on successful completion that captures method, path, status, latency, and
  // the correlation/user identifiers needed to trace a request end-to-end.
  // Non-HTTP execution contexts (e.g. RPC, scheduled jobs) are passed through untouched.
  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    // Nest's adapter returns `any`; narrow explicitly so strict eslint rules stay satisfied.
    const request = http.getRequest<unknown>() as RequestWithMeta;
    const response = http.getResponse<unknown>() as Response;
    const startedAt = Date.now();
    const requestId = request.requestId ?? 'unknown';
    const userId = request.user?.id ?? 'anonymous';
    const method = request.method ?? 'UNKNOWN';
    const url = request.originalUrl ?? request.url ?? 'UNKNOWN';

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          this.logger.log(
            `${method} ${url} -> ${response.statusCode} (${durationMs}ms) requestId=${requestId} userId=${userId}`,
          );
        },
      }),
    );
  }
}
