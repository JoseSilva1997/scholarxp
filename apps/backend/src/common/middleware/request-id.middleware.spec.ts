// Validates request-id middleware behavior so tracing stays predictable across requests.
import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';

type RequestWithRequestId = Request & {
  requestId?: string;
};

describe('RequestIdMiddleware', () => {
  it('reuses a valid incoming x-request-id header', () => {
    const middleware = new RequestIdMiddleware();
    const request = {
      headers: { 'x-request-id': 'trace_ABC-1234' },
    } as Partial<RequestWithRequestId>;
    const response = {
      setHeader: jest.fn(),
    } as Partial<Response>;
    const next = jest.fn() as NextFunction;

    middleware.use(request as RequestWithRequestId, response as Response, next);

    expect(request.requestId).toBe('trace_ABC-1234');
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'trace_ABC-1234',
    );
    expect(next).toHaveBeenCalled();
  });

  it('generates a request id when incoming header is invalid', () => {
    const middleware = new RequestIdMiddleware();
    const request = {
      headers: { 'x-request-id': 'bad id with spaces' },
    } as Partial<RequestWithRequestId>;
    const response = {
      setHeader: jest.fn(),
    } as Partial<Response>;
    const next = jest.fn() as NextFunction;

    middleware.use(request as RequestWithRequestId, response as Response, next);

    expect(request.requestId).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      request.requestId,
    );
    expect(next).toHaveBeenCalled();
  });
});
