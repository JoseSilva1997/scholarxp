// Ensures every HTTP request carries a correlation id so logs and client errors can be traced reliably.
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

type RequestWithRequestId = Request & {
  requestId?: string;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private static readonly REQUEST_ID_HEADER = 'x-request-id';
  private static readonly SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

  use(req: RequestWithRequestId, res: Response, next: NextFunction): void {
    // Reuse upstream ids when valid so distributed traces stay connected across services.
    const incomingHeader = req.headers[RequestIdMiddleware.REQUEST_ID_HEADER];
    const requestId =
      this.parseHeaderId(incomingHeader) ??
      `${Date.now().toString(36)}-${randomUUID()}`;

    // TypeScript's Express Request type doesn't always include our runtime augmentation
    // (module augmentation exists under src/types but TS may not pick it up in some contexts).
    // Use a narrow assertion here to avoid widening `req` to `any` while still allowing
    // us to attach the runtime `requestId` property safely.
    (req as unknown as { requestId?: string }).requestId = requestId;
    res.setHeader(RequestIdMiddleware.REQUEST_ID_HEADER, requestId);
    next();
  }

  private parseHeaderId(
    headerValue: string | string[] | undefined,
  ): string | undefined {
    const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!rawValue) {
      return undefined;
    }
    const value = rawValue.trim();
    return RequestIdMiddleware.SAFE_ID_PATTERN.test(value) ? value : undefined;
  }
}
