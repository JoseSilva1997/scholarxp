// Tests the mailer service behaviour for SMTP and log-only transports.
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailerService } from './mailer.service';
import { FRONTEND_URL } from '../constants';

jest.mock('nodemailer');
const mockedNodemailer = nodemailer as unknown as {
  createTransport: jest.Mock;
};

describe('MailerService', () => {
  const baseConfig = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | number | undefined> = {
        MAILER_EMAIL: 'no-reply@test.dev',
        MAILER_ALLOW_LOG_FALLBACK: 'true',
        FRONTEND_URL: FRONTEND_URL,
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs email when SMTP is not configured', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    mockedNodemailer.createTransport.mockReturnValue({} as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: baseConfig }],
    }).compile();

    const service = module.get<MailerService>(MailerService);
    // Force transporter removal to simulate log-only mode.
    (service as any).transporter = undefined;

    await service.sendMail({ to: 'user@test.dev', subject: 'Hello' });

    expect(loggerSpy).toHaveBeenCalled();
  });

  it('throws when SMTP is not configured and fallback is disabled', async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          MAILER_EMAIL: 'no-reply@test.dev',
          MAILER_ALLOW_LOG_FALLBACK: 'false',
          FRONTEND_URL: FRONTEND_URL,
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: config }],
    }).compile();

    const service = module.get<MailerService>(MailerService);
    (service as any).transporter = undefined;

    await expect(
      service.sendMail({ to: 'user@test.dev', subject: 'Hello' }),
    ).rejects.toThrow('Mailer transport is not configured');
  });

  it('sends via SMTP when host/port are set', async () => {
    const sendMail = jest.fn();
    mockedNodemailer.createTransport.mockReturnValue({ sendMail } as any);
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          MAILER_EMAIL: 'from@test.dev',
          // Include scheme and trailing slash to ensure sanitizeHost strips them.
          SMTP_HOST: 'https://smtp.test.dev/',
          SMTP_PORT: 2525,
          SMTP_USER: 'user',
          SMTP_PASS: 'pass',
          FRONTEND_URL: FRONTEND_URL,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: config }],
    }).compile();

    const service = module.get<MailerService>(MailerService);

    await service.sendMail({ to: 'user@test.dev', subject: 'Hello', text: 'Hi' });

    expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.dev',
      port: 2525,
      secure: false,
      auth: { user: 'user', pass: 'pass' },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'from@test.dev',
      to: 'user@test.dev',
      subject: 'Hello',
      text: 'Hi',
      html: undefined,
    });
  });

  it('uses secure=true when port is 465', async () => {
    const sendMail = jest.fn();
    mockedNodemailer.createTransport.mockReturnValue({ sendMail } as any);
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          MAILER_EMAIL: 'from@test.dev',
          SMTP_HOST: 'smtp.test.dev',
          SMTP_PORT: 465,
          SMTP_SECURE: 'false', // Explicitly set to false, but port 465 should override
          FRONTEND_URL: FRONTEND_URL,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: config }],
    }).compile();

    const service = module.get<MailerService>(MailerService);
    await service.sendMail({ to: 'user@test.dev', subject: 'Test' });

    expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.dev',
      port: 465,
      secure: true, // Should be true because of port 465
      auth: undefined,
    });
  });

  it('uses secure=true when SMTP_SECURE=true', async () => {
    const sendMail = jest.fn();
    mockedNodemailer.createTransport.mockReturnValue({ sendMail } as any);
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          MAILER_EMAIL: 'from@test.dev',
          SMTP_HOST: 'smtp.test.dev',
          SMTP_PORT: 587,
          SMTP_SECURE: 'true',
          FRONTEND_URL: FRONTEND_URL,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: config }],
    }).compile();

    const service = module.get<MailerService>(MailerService);
    await service.sendMail({ to: 'user@test.dev', subject: 'Test' });

    expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.dev',
      port: 587,
      secure: true,
      auth: undefined,
    });
  });

  it('sends SMTP without auth when credentials are missing', async () => {
    const sendMail = jest.fn();
    mockedNodemailer.createTransport.mockReturnValue({ sendMail } as any);
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          MAILER_EMAIL: 'from@test.dev',
          SMTP_HOST: 'smtp.test.dev',
          SMTP_PORT: 2525,
          // No SMTP_USER or SMTP_PASS
          FRONTEND_URL: FRONTEND_URL,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: config }],
    }).compile();

    const service = module.get<MailerService>(MailerService);
    await service.sendMail({ to: 'user@test.dev', subject: 'Test' });

    expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.dev',
      port: 2525,
      secure: false,
      auth: undefined, // No auth provided
    });
  });

  it('sends verification code with correct URL and HTML template', async () => {
    const sendMail = jest.fn();
    mockedNodemailer.createTransport.mockReturnValue({ sendMail } as any);
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          MAILER_EMAIL: 'noreply@test.dev',
          SMTP_HOST: 'smtp.test.dev',
          SMTP_PORT: 2525,
          FRONTEND_URL: 'https://app.test.dev',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: config }],
    }).compile();

    const service = module.get<MailerService>(MailerService);
    await service.sendVerificationCode('user@test.dev', 'ABC123');

    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe('user@test.dev');
    expect(call.subject).toBe('Your ScholarXP verification code');
    expect(call.text).toContain('ABC123');
    expect(call.html).toContain('ABC123');
    expect(call.html.toLowerCase()).not.toContain('http');
  });

  // With no links in the template, ensure we aren't accidentally including URLs.
  it('omits links when generating code email', async () => {
    const sendMail = jest.fn();
    mockedNodemailer.createTransport.mockReturnValue({ sendMail } as any);
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          MAILER_EMAIL: 'noreply@test.dev',
          SMTP_HOST: 'smtp.test.dev',
          SMTP_PORT: 2525,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: config }],
    }).compile();

    const service = module.get<MailerService>(MailerService);
    await service.sendVerificationCode('user@test.dev', 'CODE123');

    const call = sendMail.mock.calls[0][0];
    expect(call.html.toLowerCase()).not.toMatch(/http/);
    expect(call.text.toLowerCase()).not.toMatch(/http/);
  });
});
