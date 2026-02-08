// Verifies the global exception filter returns a consistent, sanitized error shape for clients.
import { BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SafeExceptionFilter } from './safe-exception.filter';
import { MailDeliveryError } from '../../mailer/mailer.service';

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
});

