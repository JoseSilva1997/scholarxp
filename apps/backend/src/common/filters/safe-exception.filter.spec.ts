// Verifies the global exception filter returns a consistent, sanitized error shape for clients.
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SafeExceptionFilter } from './safe-exception.filter';
import { MailDeliveryError } from '../../mailer/mailer.service';
import * as csrf from '../security/csrf';

describe('SafeExceptionFilter', () => {
  beforeEach(() => {
    // Silence expected filter logs so unit-test output stays readable.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createHost = (request: Partial<Request>, response: Partial<Response>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    }) as unknown as ArgumentsHost;

  it('normalizes validation arrays into a safe validation payload', () => {
    const filter = new SafeExceptionFilter();
    const request = {
      method: 'POST',
      url: '/users',
      requestId: 'req-validation-1',
    } as Partial<Request>;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    } as Partial<Response>;
    const host = createHost(request, response);
    const exception = new BadRequestException([
      'email must be an email',
      'password must be longer than 8 characters',
    ]);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed. Please review your input.',
      requestId: 'req-validation-1',
      details: [
        { message: 'email must be an email' },
        { message: 'password must be longer than 8 characters' },
      ],
    });
  });

  it('returns a safe generic payload for unexpected exceptions', () => {
    const filter = new SafeExceptionFilter();
    const request = {
      method: 'GET',
      url: '/module-units',
      requestId: 'req-500-1',
    } as Partial<Request>;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    } as Partial<Response>;
    const host = createHost(request, response);

    filter.catch(new Error('database socket timeout'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      requestId: 'req-500-1',
    });
  });

  it('returns a safe mail delivery error response with distinct code', () => {
    // Verifies that MailDeliveryError is caught and logged by the filter without leaking SMTP details.
    const filter = new SafeExceptionFilter();
    const request = {
      method: 'POST',
      url: '/auth/register',
      requestId: 'req-mail-1',
    } as Partial<Request>;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    } as Partial<Response>;
    const host = createHost(request, response);
    const exception = new MailDeliveryError(
      'recipient_unverified',
      'Email address is not verified in SES sandbox',
    );

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'EMAIL_DELIVERY_FAILED',
      message: 'Failed to send email. Please try again later.',
      requestId: 'req-mail-1',
    });
  });

  it('returns 403 CSRF payload and sets fresh token header', () => {
    jest.spyOn(csrf, 'generateToken').mockReturnValue('new-csrf-token');
    const filter = new SafeExceptionFilter();
    const request = {
      method: 'POST',
      url: '/some-action',
      requestId: 'req-csrf-1',
    } as Partial<Request>;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    } as Partial<Response>;
    const host = createHost(request, response);

    filter.catch(csrf.invalidCsrfTokenError, host);

    expect(response.setHeader).toHaveBeenCalledWith(
      'x-csrf-token',
      'new-csrf-token',
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 403,
      code: 'CSRF_TOKEN_INVALID',
      message: 'Your session expired. Please refresh and try again.',
      requestId: 'req-csrf-1',
    });
  });

  it('swallows generateToken error and still returns CSRF 403', () => {
    jest.spyOn(csrf, 'generateToken').mockImplementation(() => {
      throw new Error('session gone');
    });
    const filter = new SafeExceptionFilter();
    const request = {
      method: 'POST',
      url: '/some-action',
      requestId: 'req-csrf-2',
    } as Partial<Request>;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    } as Partial<Response>;
    const host = createHost(request, response);

    filter.catch(csrf.invalidCsrfTokenError, host);

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_TOKEN_INVALID' }),
    );
  });

  it('logs warn (not error) for 4xx HttpException', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    const filter = new SafeExceptionFilter();
    const request = {
      method: 'GET',
      url: '/profile',
      requestId: 'req-404-1',
    } as Partial<Request>;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    } as Partial<Response>;
    const host = createHost(request, response);

    filter.catch(new NotFoundException('Profile not found'), host);

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('falls back requestId to "unknown" when request has no requestId', () => {
    const filter = new SafeExceptionFilter();
    const request = { method: 'GET', url: '/test' } as Partial<Request>;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    } as Partial<Response>;
    const host = createHost(request, response);

    filter.catch(new Error('oops'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'unknown' }),
    );
  });

  describe('buildSafeHttpResponse — raw response variants', () => {
    const makeFilter = () => new SafeExceptionFilter();
    const makeResponse = () =>
      ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      }) as Partial<Response>;
    const makeRequest = (id = 'req-1') =>
      ({ method: 'POST', url: '/x', requestId: id }) as Partial<Request>;

    it('uses raw string response as message', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(new HttpException('Custom safe message', 400), host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Custom safe message' }),
      );
    });

    it('respects explicit code and message in record payload', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(
        new HttpException({ code: 'MY_CODE', message: 'My message' }, 409),
        host,
      );

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MY_CODE', message: 'My message' }),
      );
    });

    it('falls back to raw.error when message missing', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(new HttpException({ error: 'Conflict' }, 409), host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Conflict' }),
      );
    });

    it('sets VALIDATION_ERROR code only for 400 with array message', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      // 422 with array message should not override code to VALIDATION_ERROR
      filter.catch(
        new HttpException({ message: ['field is required'] }, 422),
        host,
      );

      const payload = (response.json as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('ignores blank-only string entries in message array', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(new BadRequestException(['', '  ']), host);

      const payload = (response.json as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      // No valid entries → default message, no details
      expect(payload.details).toBeUndefined();
    });

    it('attaches structured details from raw.details', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(
        new HttpException(
          {
            message: 'Bad input',
            details: [
              { field: 'email', message: 'must be an email' },
              { message: 'name is required' },
            ],
          },
          400,
        ),
        host,
      );

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: [
            { field: 'email', message: 'must be an email' },
            { message: 'name is required' },
          ],
        }),
      );
    });
  });

  describe('normalizeDetails — branch coverage', () => {
    const makeFilter = () => new SafeExceptionFilter();
    const makeResponse = () =>
      ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      }) as Partial<Response>;
    const makeRequest = () =>
      ({ method: 'POST', url: '/x', requestId: 'r1' }) as Partial<Request>;

    it('ignores non-array details', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(
        new HttpException({ message: 'Bad', details: 'not-an-array' }, 400),
        host,
      );

      const payload = (response.json as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.details).toBeUndefined();
    });

    it('filters out non-Record entries in details array', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(
        new HttpException({ message: 'Bad', details: [42, null, true] }, 400),
        host,
      );

      const payload = (response.json as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.details).toBeUndefined();
    });

    it('filters out Record entries with missing or blank message', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(
        new HttpException(
          { message: 'Bad', details: [{ field: 'x' }, { message: '  ' }] },
          400,
        ),
        host,
      );

      const payload = (response.json as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.details).toBeUndefined();
    });

    it('includes string entries in details', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(
        new HttpException(
          { message: 'Bad', details: ['field x is wrong', '  ', 'y too'] },
          400,
        ),
        host,
      );

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: [{ message: 'field x is wrong' }, { message: 'y too' }],
        }),
      );
    });

    it('omits field key when field is blank', () => {
      const filter = makeFilter();
      const response = makeResponse();
      const host = createHost(makeRequest(), response);
      filter.catch(
        new HttpException(
          { message: 'Bad', details: [{ field: '  ', message: 'oops' }] },
          400,
        ),
        host,
      );

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: [{ message: 'oops' }],
        }),
      );
    });
  });

  describe('getCodeFromStatus — all mapped codes', () => {
    const cases: [number, string][] = [
      [401, 'UNAUTHORIZED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [422, 'UNPROCESSABLE_ENTITY'],
      [429, 'TOO_MANY_REQUESTS'],
      [418, 'HTTP_418_ERROR'],
    ];

    it.each(cases)('status %i → code %s', (status, expectedCode) => {
      const filter = new SafeExceptionFilter();
      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as Partial<Response>;
      const request = {
        method: 'GET',
        url: '/x',
        requestId: 'r',
      } as Partial<Request>;
      const host = createHost(request, response);

      filter.catch(new HttpException('err', status), host);

      const payload = (response.json as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.code).toBe(expectedCode);
    });

    it('status 503 → INTERNAL_ERROR (>=500 default)', () => {
      const filter = new SafeExceptionFilter();
      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as Partial<Response>;
      const request = {
        method: 'GET',
        url: '/x',
        requestId: 'r',
      } as Partial<Request>;
      const host = createHost(request, response);

      filter.catch(new HttpException('err', 503), host);

      const payload = (response.json as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.code).toBe('INTERNAL_ERROR');
    });

    it('4xx uses <500 default message when raw has no message/error', () => {
      const filter = new SafeExceptionFilter();
      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as Partial<Response>;
      const request = {
        method: 'GET',
        url: '/x',
        requestId: 'r',
      } as Partial<Request>;
      const host = createHost(request, response);
      // Raw payload has no message or error → falls through to default
      filter.catch(new HttpException({ code: 'MY_4XX' }, 401), host);

      const payload = (response.json as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.message).toBe('The request could not be completed.');
    });
  });
});
