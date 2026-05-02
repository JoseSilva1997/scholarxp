// Verifies request logging records HTTP metadata while leaving non-HTTP streams untouched.
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  let interceptor: RequestLoggingInterceptor;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildHttpContext(
    request: unknown,
    response: unknown,
  ): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  }

  it('logs method, url, status, request id, user id, and duration for HTTP requests', async () => {
    const logger = (interceptor as unknown as { logger: { log: jest.Mock } })
      .logger;
    jest.spyOn(logger, 'log').mockImplementation();
    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1042);

    const next: CallHandler = { handle: () => of('ok') };

    const result = await lastValueFrom(
      interceptor.intercept(
        buildHttpContext(
          {
            method: 'GET',
            originalUrl: '/profile/student',
            requestId: 'req-1',
            user: { id: 9 },
          },
          { statusCode: 200 },
        ),
        next,
      ),
    );

    expect(result).toBe('ok');
    expect(logger.log).toHaveBeenCalledWith(
      'GET /profile/student -> 200 (42ms) requestId=req-1 userId=9',
    );
  });

  it('uses fallback metadata when request fields are unavailable', async () => {
    const logger = (interceptor as unknown as { logger: { log: jest.Mock } })
      .logger;
    jest.spyOn(logger, 'log').mockImplementation();
    jest.spyOn(Date, 'now').mockReturnValueOnce(2000).mockReturnValueOnce(2005);

    await lastValueFrom(
      interceptor.intercept(
        buildHttpContext({ url: '/fallback' }, { statusCode: 204 }),
        { handle: () => of('done') },
      ),
    );

    expect(logger.log).toHaveBeenCalledWith(
      'UNKNOWN /fallback -> 204 (5ms) requestId=unknown userId=anonymous',
    );
  });

  it('does not attach request logging for non-HTTP contexts', async () => {
    const logger = (interceptor as unknown as { logger: { log: jest.Mock } })
      .logger;
    jest.spyOn(logger, 'log').mockImplementation();
    const next: CallHandler = { handle: () => of('ws-result') };
    const context = {
      getType: () => 'ws',
    } as unknown as ExecutionContext;

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('ws-result');
    expect(logger.log).not.toHaveBeenCalled();
  });
});
