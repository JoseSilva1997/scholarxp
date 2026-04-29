// AuthService tests cover credential flows and auth-user projection.
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthProvider, GlobalRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EmailVerificationTokenService } from '../db-entities/email-verification-token/email-verification-token.service';
import { MailDeliveryError, MailerService } from '../mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let emailTokens: jest.Mocked<EmailVerificationTokenService>;
  let mailer: jest.Mocked<MailerService>;

  const mockUser = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    profilePictureUrl: 'https://example.com/pic.jpg',
    globalRole: GlobalRole.student,
    isVerified: true,
    timezone: 'UTC',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  };

  const mockAvatar = {
    id: 1,
    userId: 1,
    totalExp: 1000,
    equippedCosmetics: {},
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  };

  const mockVerificationToken = {
    id: 1,
    userId: 1,
    token: 'verify-token',
    reason: 'signup',
    expiresAt: new Date('2026-04-01T01:00:00.000Z'),
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    consumedAt: null,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const emailTokensMock = {
      issueToken: jest.fn(),
      consumeToken: jest.fn(),
    };
    const mailerMock = {
      sendVerificationCode: jest.fn(),
      sendPasswordResetLink: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailVerificationTokenService, useValue: emailTokensMock },
        { provide: MailerService, useValue: mailerMock },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
    emailTokens = module.get(EmailVerificationTokenService);
    mailer = module.get(MailerService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('registers a pending local user and returns an auth projection', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          create: jest
            .fn()
            .mockResolvedValue({ ...mockUser, isVerified: false }),
        },
        userPassword: { create: jest.fn() },
        authIdentity: { create: jest.fn() },
      };
      return callback(tx as any);
    });
    emailTokens.issueToken.mockResolvedValue(mockVerificationToken as any);
    mailer.sendVerificationCode.mockResolvedValue(undefined);

    const result = await service.register({
      firstName: 'John',
      lastName: 'Doe',
      email: 'JOHN@example.com',
      password: 'Password123!',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(emailTokens.issueToken).toHaveBeenCalledWith({
      userId: mockUser.id,
      reason: 'signup',
      reuseExisting: true,
    });
    expect(result.email).toBe('john@example.com');
    expect(result.requiresEmailVerification).toBe(true);
  });

  it('rejects duplicate local registrations before hashing or creating records', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(
      service.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow('Email already in use');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(emailTokens.issueToken).not.toHaveBeenCalled();
  });

  it('validates local credentials and loads student avatar progress', async () => {
    const password = 'Password123!';
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.userPassword.findUnique.mockResolvedValue({
      userId: mockUser.id,
      passwordHash: await bcrypt.hash(password, 12),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    prisma.avatar.findUnique.mockResolvedValue(mockAvatar as any);

    const result = await service.validateLocal(' JOHN@example.com ', password);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'john@example.com' },
    });
    expect(result.id).toBe(mockUser.id);
    expect(result.avatar).toEqual(
      expect.objectContaining({
        id: mockAvatar.id,
        totalExp: mockAvatar.totalExp,
      }),
    );
  });

  it('rejects local login when the password is invalid', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.userPassword.findUnique.mockResolvedValue({
      userId: mockUser.id,
      passwordHash: await bcrypt.hash('other-password', 12),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    await expect(
      service.validateLocal('john@example.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects local login when the user, password row, or verification state is missing', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.validateLocal('missing@example.com', 'Password123!'),
    ).rejects.toThrow(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValueOnce(mockUser);
    prisma.userPassword.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.validateLocal('john@example.com', 'Password123!'),
    ).rejects.toThrow(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      isVerified: false,
    });
    prisma.userPassword.findUnique.mockResolvedValueOnce({
      userId: mockUser.id,
      passwordHash: await bcrypt.hash('Password123!', 12),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    await expect(
      service.validateLocal('john@example.com', 'Password123!'),
    ).rejects.toThrow('Email not verified');
  });

  it('verifies email and returns the refreshed auth user', async () => {
    emailTokens.consumeToken.mockResolvedValue(mockVerificationToken as any);
    prisma.user.update.mockResolvedValue(mockUser);
    prisma.avatar.findUnique.mockResolvedValue(mockAvatar as any);

    const result = await service.verifyEmail('verify-token');

    expect(emailTokens.consumeToken).toHaveBeenCalledWith('verify-token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockVerificationToken.userId },
      data: { isVerified: true },
    });
    expect(result.requiresEmailVerification).toBe(false);
  });

  it('logs in an existing Google identity and refreshes changed profile fields', async () => {
    const googleProfile = {
      provider: 'google' as const,
      providerUserId: 'google-1',
      email: 'john@example.com',
      firstName: 'Johnny',
      lastName: 'Doe',
      picture: 'https://example.com/new.jpg',
    };
    prisma.authIdentity.findUnique.mockResolvedValue({
      id: 1,
      userId: mockUser.id,
      provider: AuthProvider.google,
      providerUserId: googleProfile.providerUserId,
      email: mockUser.email,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      user: mockUser,
    } as any);
    prisma.user.update.mockResolvedValue({
      ...mockUser,
      firstName: googleProfile.firstName,
      profilePictureUrl: googleProfile.picture,
    });
    prisma.avatar.findUnique.mockResolvedValue(mockAvatar as any);

    const result = await service.loginWithGoogle(googleProfile);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: {
        firstName: googleProfile.firstName,
        profilePictureUrl: googleProfile.picture,
      },
    });
    expect(result.firstName).toBe(googleProfile.firstName);
  });

  it('loads a session user by id', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.avatar.findUnique.mockResolvedValue(mockAvatar as any);

    const result = await service.getUserById(mockUser.id);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUser.id },
    });
    expect(result.email).toBe(mockUser.email);
    expect(result.avatar).not.toBeNull();
  });

  it('rejects a missing session user id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getUserById(404)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches capabilities from the shared permission evaluator', () => {
    const result = service.attachCapabilities({
      id: mockUser.id,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      email: mockUser.email,
      profilePictureUrl: mockUser.profilePictureUrl,
      globalRole: GlobalRole.teacher,
      isVerified: true,
      timezone: 'UTC',
      avatar: null,
    });

    expect(result.capabilities).toContain('modules_create');
  });

  it('regenerates sessions before login', async () => {
    const req = {
      session: { regenerate: jest.fn((callback) => callback(null)) },
      login: jest.fn((_user, callback) => callback(null)),
    } as unknown as Request;
    const user = {
      id: mockUser.id,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      email: mockUser.email,
      profilePictureUrl: mockUser.profilePictureUrl,
      globalRole: mockUser.globalRole,
      isVerified: true,
      timezone: 'UTC',
      avatar: null,
    };

    await service.loginUser(req, user);

    expect(req.session.regenerate).toHaveBeenCalled();
    expect(req.login).toHaveBeenCalledWith(user, expect.any(Function));
  });

  it('preserves whitelisted session keys during login session regeneration', async () => {
    const req = {
      session: {
        regenerate: jest.fn(function (this: Record<string, unknown>, callback) {
          callback(null);
        }),
      },
      login: jest.fn((_user, callback) => callback(null)),
    } as unknown as Request;
    const user = {
      id: mockUser.id,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      email: mockUser.email,
      profilePictureUrl: mockUser.profilePictureUrl,
      globalRole: mockUser.globalRole,
      isVerified: true,
      timezone: 'UTC',
      avatar: null,
    };

    await service.loginUser(req, user, {
      persistSession: { postAuthRedirect: '/invite?token=abc' },
    });

    expect(
      (req.session as unknown as Record<string, unknown>).postAuthRedirect,
    ).toBe('/invite?token=abc');
  });

  it('surfaces session regeneration and Passport login failures as internal errors', async () => {
    await expect(
      service.regenerateSession({
        session: { regenerate: jest.fn((callback) => callback('boom')) },
      } as unknown as Request),
    ).rejects.toThrow('boom');

    const req = {
      session: { regenerate: jest.fn((callback) => callback(null)) },
      login: jest.fn((_user, callback) => callback('login boom')),
    } as unknown as Request;
    await expect(
      service.loginUser(req, {
        id: mockUser.id,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        email: mockUser.email,
        profilePictureUrl: mockUser.profilePictureUrl,
        globalRole: mockUser.globalRole,
        isVerified: true,
        timezone: 'UTC',
        avatar: null,
      }),
    ).rejects.toThrow('login boom');
  });

  it('logs out, regenerates an anonymous session, and reuses an existing csrf secret without requiring a response', async () => {
    const req = {
      logout: jest.fn((callback) => callback()),
      session: {
        csrfSecret: 'existing-secret',
        regenerate: jest.fn((callback) => callback(null)),
      },
    } as unknown as Request;

    const token = await service.logout(req);

    expect(req.logout).toHaveBeenCalled();
    expect(req.session.regenerate).toHaveBeenCalled();
    expect((req.session as unknown as { csrfSecret: string }).csrfSecret).toBe(
      'existing-secret',
    );
    expect(typeof token).toBe('string');
  });

  it('sets a fresh csrf header on logout when a response is provided', async () => {
    const req = {
      logout: jest.fn((callback) => callback()),
      session: {
        regenerate: jest.fn((callback) => callback(null)),
      },
    } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;

    const token = await service.logout(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('x-csrf-token', token);
  });

  it('issues a url-style reset token and emails a reset link when a local account exists', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.userPassword.findUnique.mockResolvedValue({
      userId: mockUser.id,
      passwordHash: 'hash',
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    emailTokens.issueToken.mockResolvedValue({
      ...mockVerificationToken,
      reason: 'password_reset',
      token: 'opaque-token-abc',
    } as any);
    mailer.sendPasswordResetLink.mockResolvedValue(undefined);

    const result = await service.requestPasswordReset(' JOHN@example.com ');

    expect(emailTokens.issueToken).toHaveBeenCalledWith({
      userId: mockUser.id,
      reason: 'password_reset',
      reuseExisting: true,
      ttlMinutes: 30,
      tokenStyle: 'url',
    });
    expect(mailer.sendPasswordResetLink).toHaveBeenCalledWith(
      'john@example.com',
      expect.stringMatching(/\/reset-password\?token=opaque-token-abc$/),
    );
    expect(result).toEqual({ sent: true });
  });

  it('builds password reset links with the first configured CORS origin and falls back for malformed origins', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.userPassword.findUnique.mockResolvedValue({
      userId: mockUser.id,
      passwordHash: 'hash',
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    emailTokens.issueToken.mockResolvedValue({
      ...mockVerificationToken,
      reason: 'password_reset',
      token: 'reset-token',
    } as any);
    process.env.CORS_ORIGIN = 'https://primary.test,https://secondary.test';

    await service.requestPasswordReset(mockUser.email);

    expect(mailer.sendPasswordResetLink).toHaveBeenCalledWith(
      'john@example.com',
      'https://primary.test/reset-password?token=reset-token',
    );

    mailer.sendPasswordResetLink.mockClear();
    process.env.CORS_ORIGIN = 'not a valid origin';
    await service.requestPasswordReset(mockUser.email);

    expect(mailer.sendPasswordResetLink).toHaveBeenCalledWith(
      'john@example.com',
      'not a valid origin/reset-password?token=reset-token',
    );
    delete process.env.CORS_ORIGIN;
  });

  it('hides account existence when requesting reset for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.requestPasswordReset('missing@example.com');

    expect(emailTokens.issueToken).not.toHaveBeenCalled();
    expect(mailer.sendPasswordResetLink).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: true });
  });

  it('reports no_password for OAuth-only accounts so the UI can guide the user to Google', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.userPassword.findUnique.mockResolvedValue(null);

    const result = await service.requestPasswordReset(mockUser.email);

    expect(emailTokens.issueToken).not.toHaveBeenCalled();
    expect(mailer.sendPasswordResetLink).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, reason: 'no_password' });
  });

  it('consumes a reset-scoped token and rewrites the password hash', async () => {
    emailTokens.consumeToken.mockResolvedValue({
      ...mockVerificationToken,
      reason: 'password_reset',
    } as any);
    prisma.userPassword.upsert.mockResolvedValue({
      userId: mockUser.id,
      passwordHash: 'new-hash',
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const result = await service.resetPassword('123456', 'NewPassword123!');

    expect(emailTokens.consumeToken).toHaveBeenCalledWith(
      '123456',
      'password_reset',
    );
    expect(prisma.userPassword.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: mockUser.id } }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('handles resend verification outcomes for missing, verified, and pending users', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.resendVerification('missing@example.com'),
    ).rejects.toThrow(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValueOnce(mockUser);
    await expect(service.resendVerification(mockUser.email)).resolves.toEqual({
      sent: false,
      reason: 'already_verified',
    });

    prisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      isVerified: false,
    });
    emailTokens.issueToken.mockResolvedValueOnce(mockVerificationToken as any);
    await expect(service.resendVerification(mockUser.email)).resolves.toEqual({
      sent: true,
    });
    expect(emailTokens.issueToken).toHaveBeenCalledWith({
      userId: mockUser.id,
      reason: 'signup',
      reuseExisting: false,
    });
  });

  it('keeps verification and reset flows user-safe when mail delivery fails', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockUser);
    prisma.$transaction.mockImplementationOnce(async (callback) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            ...mockUser,
            isVerified: false,
          }),
        },
        userPassword: { create: jest.fn() },
        authIdentity: { create: jest.fn() },
      };
      return callback(tx as any);
    });
    emailTokens.issueToken.mockResolvedValueOnce(mockVerificationToken as any);
    mailer.sendVerificationCode.mockRejectedValueOnce(
      new MailDeliveryError('rejected', { code: 'recipient_unverified' }),
    );

    await expect(
      service.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
      }),
    ).resolves.toMatchObject({ requiresEmailVerification: true });

    prisma.userPassword.findUnique.mockResolvedValue({
      userId: mockUser.id,
      passwordHash: 'hash',
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    emailTokens.issueToken.mockResolvedValueOnce({
      ...mockVerificationToken,
      reason: 'password_reset',
      token: 'reset-token',
    } as any);
    mailer.sendPasswordResetLink.mockRejectedValueOnce(
      new Error('smtp unavailable'),
    );

    await expect(service.requestPasswordReset(mockUser.email)).resolves.toEqual(
      { sent: true },
    );
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects malformed Google profile payloads before OAuth login', () => {
    expect(() => service.validateGoogleProfile(null)).toThrow(
      UnauthorizedException,
    );
    expect(() => service.validateGoogleProfile({ provider: 'google' })).toThrow(
      UnauthorizedException,
    );
    expect(
      service.validateGoogleProfile({
        provider: 'google',
        providerUserId: 'google-1',
      }),
    ).toEqual({ provider: 'google', providerUserId: 'google-1' });
  });

  it('rejects Google login when Google does not provide an email address', async () => {
    await expect(
      service.loginWithGoogle({
        provider: 'google',
        providerUserId: 'google-1',
        email: null,
        firstName: 'No',
        lastName: 'Email',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('logs in an existing Google identity without updating unchanged profile fields', async () => {
    prisma.authIdentity.findUnique.mockResolvedValue({
      id: 1,
      userId: mockUser.id,
      provider: AuthProvider.google,
      providerUserId: 'google-1',
      email: mockUser.email,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      user: mockUser,
    } as any);
    prisma.avatar.findUnique.mockResolvedValue(mockAvatar as any);

    const result = await service.loginWithGoogle({
      provider: 'google',
      providerUserId: 'google-1',
      email: ' JOHN@example.com ',
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      picture: mockUser.profilePictureUrl,
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result.id).toBe(mockUser.id);
  });

  it('links Google auth to an existing user by email', async () => {
    prisma.authIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      globalRole: GlobalRole.pending,
      isVerified: false,
    });
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          update: jest.fn().mockResolvedValue({
            ...mockUser,
            firstName: 'Google',
            isVerified: false,
          }),
        },
        authIdentity: { create: jest.fn() },
      };
      return callback(tx as any);
    });

    const result = await service.loginWithGoogle({
      provider: 'google',
      providerUserId: 'google-2',
      email: 'john@example.com',
      firstName: 'Google',
      lastName: mockUser.lastName,
      picture: mockUser.profilePictureUrl,
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.firstName).toBe('Google');
  });

  it('creates a pending verified user for a new Google account with safe blank-name defaults', async () => {
    prisma.authIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            ...mockUser,
            firstName: '',
            lastName: '',
            globalRole: GlobalRole.pending,
            isVerified: true,
          }),
        },
        authIdentity: { create: jest.fn() },
      };
      return callback(tx as any);
    });

    const result = await service.loginWithGoogle({
      provider: 'google',
      providerUserId: 'google-3',
      email: 'new@example.com',
      firstName: '',
      lastName: '',
    });

    expect(result.globalRole).toBe(GlobalRole.pending);
    expect(result.requiresEmailVerification).toBe(false);
  });

  it('handles Google callback login, clears captured redirect, and prevents auth-route redirects', async () => {
    const user = {
      id: mockUser.id,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      email: mockUser.email,
      profilePictureUrl: mockUser.profilePictureUrl,
      globalRole: mockUser.globalRole,
      isVerified: true,
      timezone: 'UTC',
      avatar: null,
    };
    jest.spyOn(service, 'loginWithGoogle').mockResolvedValue(user);
    jest.spyOn(service, 'loginUser').mockResolvedValue(undefined);
    const req = {
      user: {
        provider: 'google',
        providerUserId: 'google-1',
        email: 'john@example.com',
      },
      session: { postAuthRedirect: '/login?next=/invite' },
    } as unknown as Request;
    const res = { redirect: jest.fn() } as unknown as Response;
    process.env.CORS_ORIGIN = 'https://app.test,https://secondary.test';

    await service.handleGoogleCallback(req, res);

    expect(service.loginUser).toHaveBeenCalledWith(req, user, {
      persistSession: { postAuthRedirect: '/login?next=/invite' },
    });
    expect('postAuthRedirect' in (req.session as unknown as object)).toBe(
      false,
    );
    expect(res.redirect).toHaveBeenCalledWith('https://app.test/main');
    delete process.env.CORS_ORIGIN;
  });

  it('redirects Google callbacks to safe captured relative paths and handles malformed origins', async () => {
    jest.spyOn(service, 'loginWithGoogle').mockResolvedValue({
      id: mockUser.id,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      email: mockUser.email,
      profilePictureUrl: mockUser.profilePictureUrl,
      globalRole: mockUser.globalRole,
      isVerified: true,
      timezone: 'UTC',
      avatar: null,
    });
    jest.spyOn(service, 'loginUser').mockResolvedValue(undefined);
    const req = {
      user: {
        provider: 'google',
        providerUserId: 'google-1',
        email: 'john@example.com',
      },
      session: { postAuthRedirect: '/invite?token=abc#join' },
    } as unknown as Request;
    const res = { redirect: jest.fn() } as unknown as Response;
    process.env.CORS_ORIGIN = 'not a valid origin';

    await service.handleGoogleCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      'not a valid origin/invite?token=abc#join',
    );
    delete process.env.CORS_ORIGIN;
  });

  it('returns and attaches a csrf token when one can be minted', () => {
    const req = { session: {} } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;

    const token = service.attachCsrfHeader(req, res);

    expect(typeof token).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith('x-csrf-token', token);
  });

  it('returns null instead of setting a csrf header when token generation fails', () => {
    const req = {} as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;

    expect(service.tryGenerateCsrfToken(req)).toBeNull();
    expect(service.attachCsrfHeader(req, res)).toBeNull();
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
