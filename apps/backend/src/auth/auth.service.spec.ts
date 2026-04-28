// AuthService tests cover credential flows and auth-user projection.
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthProvider, GlobalRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EmailVerificationTokenService } from '../db-entities/email-verification-token/email-verification-token.service';
import { MailerService } from '../mailer/mailer.service';
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

  it('returns and attaches a csrf token when one can be minted', () => {
    const req = { session: {} } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;

    const token = service.attachCsrfHeader(req, res);

    expect(typeof token).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith('x-csrf-token', token);
  });
});
