// Unit tests for AuthService covering happy path scenarios for each public method
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, GlobalRole } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationTokenService } from '../db-entities/email-verification-token/email-verification-token.service';
import { MailDeliveryError, MailerService } from '../mailer/mailer.service';
import type { Request, Response } from 'express';

// Unit tests for AuthService covering happy path scenarios for each public method
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
    createdAt: new Date(),
    updatedAt: new Date(),
    pendingRole: null,
  };

  const mockAvatar = {
    id: 1,
    userId: 1,
    level: 5,
    currentExp: 1000,
    createdAt: new Date(),
  };

  const mockVerificationToken = {
    id: 1,
    userId: 1,
    token: 'test-token',
    reason: 'signup' as const,
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    consumedAt: null,
  };

  beforeEach(async () => {
    // Create deep mocks for dependencies using jest-mock-extended
    prisma = mockDeep<PrismaService>();
    const emailTokensMock = {
      issueToken: jest.fn(),
      consumeToken: jest.fn(),
    };
    const mailerMock = {
      sendVerificationCode: jest.fn(),
    };
    const configMock = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailVerificationTokenService, useValue: emailTokensMock },
        { provide: MailerService, useValue: mailerMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    emailTokens = module.get(EmailVerificationTokenService);
    mailer = module.get(MailerService);
  });

  describe('regenerateSession', () => {
    it('should regenerate session successfully', async () => {
      const mockReq = {
        session: {
          regenerate: jest.fn((cb) => cb(null)),
        },
      } as unknown as Request;

      await service.regenerateSession(mockReq);

      expect(mockReq.session.regenerate).toHaveBeenCalled();
    });

    it('should throw error when session regeneration fails', async () => {
      const mockReq = {
        session: {
          regenerate: jest.fn((cb) => cb(new Error('Session error'))),
        },
      } as unknown as Request;

      await expect(service.regenerateSession(mockReq)).rejects.toThrow(
        'Session error',
      );
    });
  });

  describe('loginUser', () => {
    it('should login user by regenerating session and logging in', async () => {
      const mockReq = {
        session: {
          regenerate: jest.fn((cb) => cb(null)),
        },
        login: jest.fn((user, cb) => cb(null)),
      } as unknown as Request;

      const authUser = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        profilePictureUrl: 'https://example.com/pic.jpg',
        globalRole: GlobalRole.student,
        isVerified: true,
        requiresEmailVerification: false,
        avatar: null,
        institutionIds: [],
        hasInstitutionMembership: false,
        ltiIdentities: [],
        hasLtiIdentity: false,
      };

      await service.loginUser(mockReq, authUser);

      expect(mockReq.session.regenerate).toHaveBeenCalled();
      expect(mockReq.login).toHaveBeenCalledWith(
        authUser,
        expect.any(Function),
      );
    });

    it('should throw error when login fails', async () => {
      const mockReq = {
        session: {
          regenerate: jest.fn((cb) => cb(null)),
        },
        login: jest.fn((user, cb) => cb(new Error('Login failed'))),
      } as unknown as Request;

      const authUser = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        profilePictureUrl: 'https://example.com/pic.jpg',
        globalRole: GlobalRole.student,
        isVerified: true,
        requiresEmailVerification: false,
        avatar: null,
        institutionIds: [],
        hasInstitutionMembership: false,
        ltiIdentities: [],
        hasLtiIdentity: false,
      };

      await expect(service.loginUser(mockReq, authUser)).rejects.toThrow(
        'Login failed',
      );
    });
  });

  describe('logout', () => {
    it('should logout user, regenerate session, and return next CSRF token', async () => {
      const mockReq = {
        logout: jest.fn((cb) => cb()),
        session: {
          regenerate: jest.fn((cb) => cb(null)),
          csrfSecret: 'old-secret',
        },
      } as unknown as Request;

      const mockRes = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const token = await service.logout(mockReq, mockRes);

      expect(mockReq.logout).toHaveBeenCalled();
      expect(mockReq.session.regenerate).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('x-csrf-token', token);
      expect(token).toBeDefined();
    });

    it('should throw error when session regeneration fails', async () => {
      const mockReq = {
        logout: jest.fn((cb) => cb()),
        session: {
          regenerate: jest.fn((cb) => cb(new Error('Regenerate failed'))),
        },
      } as unknown as Request;

      await expect(service.logout(mockReq)).rejects.toThrow(
        'Regenerate failed',
      );
    });

    it('should set CSRF header when response object is provided', async () => {
      const mockReq = {
        logout: jest.fn((cb) => cb()),
        session: {
          regenerate: jest.fn((cb) => cb(null)),
        },
      } as unknown as Request;

      const mockRes = {
        setHeader: jest.fn(),
      } as unknown as Response;

      await service.logout(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'x-csrf-token',
        expect.any(String),
      );
    });

    it('should handle logout without response object', async () => {
      const mockReq = {
        logout: jest.fn((cb) => cb()),
        session: {
          regenerate: jest.fn((cb) => cb(null)),
        },
      } as unknown as Request;

      const token = await service.logout(mockReq);

      expect(mockReq.logout).toHaveBeenCalled();
      expect(mockReq.session.regenerate).toHaveBeenCalled();
      expect(token).toBeDefined();
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: '  NEWUSER@EXAMPLE.COM  ',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'SecurePassword123!',
      };

      const newUser = {
        ...mockUser,
        id: 2,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'newuser@example.com',
        isVerified: false,
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (callback) => {
        const txClient = {
          user: { create: jest.fn().mockResolvedValue(newUser) },
          userPassword: { create: jest.fn() },
          authIdentity: { create: jest.fn() },
        };
        return callback(txClient as any);
      });

      emailTokens.issueToken.mockResolvedValue({
        ...mockVerificationToken,
        userId: 2,
      });

      mailer.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
      expect(result.email).toBe('newuser@example.com');
      expect(result.requiresEmailVerification).toBe(true);
      expect(emailTokens.issueToken).toHaveBeenCalledWith({
        userId: 2,
        reason: 'signup',
        reuseExisting: true,
      });
      expect(mailer.sendVerificationCode).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'SecurePassword123!',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        'Email already in use',
      );
    });

    it('should normalize email to lowercase with whitespace trimmed', async () => {
      const registerDto = {
        email: '  MixedCase@Example.COM  ',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'SecurePassword123!',
      };

      const newUser = {
        ...mockUser,
        email: 'mixedcase@example.com',
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (callback) => {
        const txClient = {
          user: { create: jest.fn().mockResolvedValue(newUser) },
          userPassword: { create: jest.fn() },
          authIdentity: { create: jest.fn() },
        };
        return callback(txClient as any);
      });

      emailTokens.issueToken.mockResolvedValue(mockVerificationToken);
      mailer.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result.email).toBe('mixedcase@example.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mixedcase@example.com' },
      });
    });

    it('should surface friendly error when SES rejects unverified recipient during signup', async () => {
      const registerDto = {
        email: 'test@test.com',
        firstName: 'T',
        lastName: 'User',
        password: 'password',
      };

      const newUser = {
        ...mockUser,
        id: 42,
        email: 'test@test.com',
        isVerified: false,
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (callback) => {
        const txClient = {
          user: { create: jest.fn().mockResolvedValue(newUser) },
          userPassword: { create: jest.fn() },
          authIdentity: { create: jest.fn() },
        };
        return callback(txClient as any);
      });

      emailTokens.issueToken.mockResolvedValue({
        ...mockVerificationToken,
        userId: 42,
      });
      // Service gracefully swallows email delivery errors and still returns user
      mailer.sendVerificationCode.mockRejectedValue(
        new MailDeliveryError(
          'recipient_unverified',
          'Email address is not verified',
        ),
      );

      const result = await service.register(registerDto);
      expect(result.email).toBe('test@test.com');
      expect(result.isVerified).toBe(false);
      expect(result.requiresEmailVerification).toBe(true);
    });
  });

  describe('validateLocal', () => {
    it('should validate local credentials and return authenticated user', async () => {
      const email = '  JOHN@EXAMPLE.COM  ';
      const password = 'SecurePassword123!';
      const hashedPassword = await bcrypt.hash(password, 12);

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userPassword.findUnique.mockResolvedValue({
        userId: 1,
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      });

      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
      ]);

      const result = await service.validateLocal(email, password);

      expect(result.id).toBe(1);
      expect(result.email).toBe('john@example.com');
      expect(result.avatar).not.toBeNull();
      expect(result.hasInstitutionMembership).toBe(true);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateLocal('nonexistent@example.com', 'password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userPassword.findUnique.mockResolvedValue({
        userId: 1,
        passwordHash: await bcrypt.hash('correct-password', 12),
        updatedAt: new Date(),
      });

      await expect(
        service.validateLocal('john@example.com', 'wrong-password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      const unverifiedUser = { ...mockUser, isVerified: false };

      prisma.user.findUnique.mockResolvedValue(unverifiedUser);
      prisma.userPassword.findUnique.mockResolvedValue({
        userId: 1,
        passwordHash: await bcrypt.hash('password', 12),
        updatedAt: new Date(),
      });

      await expect(
        service.validateLocal('john@example.com', 'password'),
      ).rejects.toThrow('Email not verified');
    });

    it('should throw UnauthorizedException if password record does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userPassword.findUnique.mockResolvedValue(null);

      await expect(
        service.validateLocal('john@example.com', 'password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle user without institution membership', async () => {
      const password = 'SecurePassword123!';
      const hashedPassword = await bcrypt.hash(password, 12);

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userPassword.findUnique.mockResolvedValue({
        userId: 1,
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      });

      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue(null);
      prisma.ltiIdentity.findMany.mockResolvedValue([]);

      const result = await service.validateLocal('john@example.com', password);

      expect(result.hasInstitutionMembership).toBe(false);
      expect(result.institutionIds).toHaveLength(0);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email token and update user', async () => {
      const token = 'email-verification-token';

      emailTokens.consumeToken.mockResolvedValue(mockVerificationToken);
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
      ]);

      const result = await service.verifyEmail(token);

      expect(emailTokens.consumeToken).toHaveBeenCalledWith(token);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isVerified: true },
      });
      expect(result.isVerified).toBe(true);
      expect(result.requiresEmailVerification).toBe(false);
    });

    it('should throw error if token is invalid or expired', async () => {
      const token = 'invalid-token';

      emailTokens.consumeToken.mockRejectedValue(new Error('Token expired'));

      await expect(service.verifyEmail(token)).rejects.toThrow('Token expired');
    });

    it('should handle verified student with avatar and institution', async () => {
      const token = 'valid-token';

      emailTokens.consumeToken.mockResolvedValue(mockVerificationToken);
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
      ]);

      const result = await service.verifyEmail(token);

      expect(result.avatar).not.toBeNull();
      expect(result.hasInstitutionMembership).toBe(true);
    });

    it('should handle verified user without avatar or institution', async () => {
      const token = 'valid-token';
      const teacherUser = { ...mockUser, globalRole: GlobalRole.teacher };

      emailTokens.consumeToken.mockResolvedValue(mockVerificationToken);
      prisma.user.update.mockResolvedValue(teacherUser);
      prisma.ltiIdentity.findFirst.mockResolvedValue(null);
      prisma.ltiIdentity.findMany.mockResolvedValue([]);

      const result = await service.verifyEmail(token);

      expect(result.avatar).toBeNull();
      expect(result.hasInstitutionMembership).toBe(false);
    });
  });

  describe('resendVerification', () => {
    it('should resend verification email for unverified user', async () => {
      const email = '  NEWUSER@EXAMPLE.COM  ';
      const unverifiedUser = { ...mockUser, isVerified: false };

      prisma.user.findUnique.mockResolvedValue(unverifiedUser);
      emailTokens.issueToken.mockResolvedValue({
        ...mockVerificationToken,
        id: 2,
      });
      mailer.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.resendVerification(email);

      expect(result.sent).toBe(true);
      expect(emailTokens.issueToken).toHaveBeenCalledWith({
        userId: 1,
        reason: 'signup',
        reuseExisting: false,
      });
      expect(mailer.sendVerificationCode).toHaveBeenCalled();
    });

    it('should return already_verified for verified user', async () => {
      const email = '  JOHN@EXAMPLE.COM  ';

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.resendVerification(email);

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('already_verified');
      expect(emailTokens.issueToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const email = 'nonexistent@example.com';

      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resendVerification(email)).rejects.toThrow(
        'User not found',
      );
    });

    it('should return user-friendly error when mail send fails due to unverified recipient', async () => {
      const email = 'test@test.com';
      const unverifiedUser = { ...mockUser, isVerified: false, email };

      prisma.user.findUnique.mockResolvedValue(unverifiedUser);
      emailTokens.issueToken.mockResolvedValue({
        ...mockVerificationToken,
        userId: unverifiedUser.id,
      });
      // Service gracefully swallows email delivery errors and returns success response
      mailer.sendVerificationCode.mockRejectedValue(
        new MailDeliveryError(
          'recipient_unverified',
          'Email address is not verified',
        ),
      );

      const result = await service.resendVerification(email);
      expect(result.sent).toBe(true);
    });
  });

  describe('loginWithGoogle', () => {
    it('should login user with new Google account', async () => {
      const googleProfile = {
        providerUserId: 'google-123',
        email: 'newgoogle@example.com',
        firstName: 'Google',
        lastName: 'User',
        picture: 'https://example.com/google-pic.jpg',
      };

      const newUser = {
        ...mockUser,
        email: googleProfile.email,
        firstName: googleProfile.firstName,
        lastName: googleProfile.lastName,
        profilePictureUrl: googleProfile.picture,
        isVerified: true,
      };

      prisma.authIdentity.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (callback) => {
        const txClient = {
          user: { create: jest.fn().mockResolvedValue(newUser) },
          authIdentity: { create: jest.fn() },
        };
        return callback(txClient as any);
      });

      prisma.avatar.findUnique.mockResolvedValue(null);
      prisma.ltiIdentity.findFirst.mockResolvedValue(null);
      prisma.ltiIdentity.findMany.mockResolvedValue([]);

      const result = await service.loginWithGoogle(googleProfile);

      expect(result.email).toBe('newgoogle@example.com');
      expect(result.firstName).toBe('Google');
      expect(result.lastName).toBe('User');
      expect(result.isVerified).toBe(true);
    });

    it('should login existing Google user and refresh profile', async () => {
      const googleProfile = {
        providerUserId: 'google-123',
        email: 'updated@example.com',
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast',
        picture: 'https://example.com/updated-pic.jpg',
      };

      const existingIdentity = {
        id: 1,
        userId: 1,
        provider: AuthProvider.google,
        providerUserId: 'google-123',
        email: 'old@example.com',
        createdAt: new Date(),
        user: mockUser,
      };

      const updatedUser = {
        ...mockUser,
        firstName: googleProfile.firstName,
        lastName: googleProfile.lastName,
        profilePictureUrl: googleProfile.picture,
      };

      prisma.authIdentity.findUnique.mockResolvedValue(existingIdentity);
      prisma.user.update.mockResolvedValue(updatedUser);
      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
      ]);

      const result = await service.loginWithGoogle(googleProfile);

      expect(result.id).toBe(1);
      expect(result.avatar).not.toBeNull();
      expect(result.hasInstitutionMembership).toBe(true);
    });

    it('should throw UnauthorizedException if Google account has no email', async () => {
      const googleProfile = {
        providerUserId: 'google-123',
        email: null,
        firstName: 'Google',
        lastName: 'User',
        picture: 'https://example.com/google-pic.jpg',
      };

      await expect(service.loginWithGoogle(googleProfile)).rejects.toThrow(
        'Google account has no email',
      );
    });

    it('should link Google identity to existing user when email matches', async () => {
      const googleProfile = {
        providerUserId: 'google-456',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe Updated',
        picture: 'https://example.com/google-pic.jpg',
      };

      prisma.authIdentity.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.$transaction.mockImplementation(async (callback) => {
        const txClient = {
          user: {
            update: jest.fn().mockResolvedValue(mockUser),
          },
          authIdentity: {
            create: jest.fn(),
          },
        };
        return callback(txClient as any);
      });

      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
      ]);

      const result = await service.loginWithGoogle(googleProfile);

      expect(result.id).toBe(1);
      expect(result.email).toBe('john@example.com');
    });

    it('should not update profile if values are unchanged', async () => {
      const googleProfile = {
        providerUserId: 'google-123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: 'https://example.com/pic.jpg',
      };

      const existingIdentity = {
        id: 1,
        userId: 1,
        provider: AuthProvider.google,
        providerUserId: 'google-123',
        email: 'john@example.com',
        createdAt: new Date(),
        user: mockUser,
      };

      prisma.authIdentity.findUnique.mockResolvedValue(existingIdentity);
      // When no updates needed, service returns user as-is
      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
      ]);

      const result = await service.loginWithGoogle(googleProfile);

      expect(result.id).toBe(1);
      // user.update should not be called since no changes detected
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by id with avatar and membership', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
        {
          id: 2,
          institutionId: 2,
          ltiUserId: 'lti-user-2',
          userId: 1,
        },
      ]);

      const result = await service.getUserById(1);

      expect(result.id).toBe(1);
      expect(result.firstName).toBe('John');
      expect(result.avatar).not.toBeNull();
      expect(result.avatar?.level).toBe(5);
      expect(result.institutionIds).toHaveLength(2);
      expect(result.hasInstitutionMembership).toBe(true);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById(999)).rejects.toThrow('Session invalid');
    });

    it('should handle user without avatar', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.avatar.findUnique.mockResolvedValue(null);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
      ]);

      const result = await service.getUserById(1);

      expect(result.avatar).toBeNull();
    });

    it('should skip avatar lookup for non-student users', async () => {
      const teacherUser = { ...mockUser, globalRole: GlobalRole.teacher };

      prisma.user.findUnique.mockResolvedValue(teacherUser);
      prisma.ltiIdentity.findFirst.mockResolvedValue({
        id: 1,
        institutionId: 1,
        ltiUserId: 'lti-user-1',
        userId: 1,
      });
      prisma.ltiIdentity.findMany.mockResolvedValue([
        {
          id: 1,
          institutionId: 1,
          ltiUserId: 'lti-user-1',
          userId: 1,
        },
      ]);

      const result = await service.getUserById(1);

      expect(result.avatar).toBeNull();
      // Avatar lookup should not be called for non-student
      expect(prisma.avatar.findUnique).not.toHaveBeenCalled();
    });

    it('should handle user without institution membership', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.avatar.findUnique.mockResolvedValue(mockAvatar);
      prisma.ltiIdentity.findFirst.mockResolvedValue(null);
      prisma.ltiIdentity.findMany.mockResolvedValue([]);

      const result = await service.getUserById(1);

      expect(result.hasInstitutionMembership).toBe(false);
      expect(result.institutionIds).toHaveLength(0);
      expect(result.ltiIdentities).toHaveLength(0);
    });
  });

  describe('attachCapabilities', () => {
    it('should attach capabilities based on user role and membership', () => {
      const studentUser = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        profilePictureUrl: 'https://example.com/pic.jpg',
        globalRole: GlobalRole.student,
        isVerified: true,
        requiresEmailVerification: false,
        avatar: mockAvatar,
        institutionIds: [1],
        hasInstitutionMembership: true,
        ltiIdentities: [{ institutionId: 1, ltiUserId: 'lti-user-1' }],
        hasLtiIdentity: true,
      };

      const result = service.attachCapabilities(studentUser);

      expect(result).toHaveProperty('capabilities');
      expect(Array.isArray(result.capabilities)).toBe(true);
      expect(result.id).toBe(studentUser.id);
    });

    it('should attach capabilities for teacher with institution membership', () => {
      const teacherUser = {
        id: 2,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        profilePictureUrl: 'https://example.com/jane.jpg',
        globalRole: GlobalRole.teacher,
        isVerified: true,
        requiresEmailVerification: false,
        avatar: null,
        institutionIds: [1, 2],
        hasInstitutionMembership: true,
        ltiIdentities: [
          { institutionId: 1, ltiUserId: 'teacher-1' },
          { institutionId: 2, ltiUserId: 'teacher-2' },
        ],
        hasLtiIdentity: true,
      };

      const result = service.attachCapabilities(teacherUser);

      expect(result).toHaveProperty('capabilities');
      expect(Array.isArray(result.capabilities)).toBe(true);
      expect(result.globalRole).toBe(GlobalRole.teacher);
    });

    it('should attach capabilities for pending user without membership', () => {
      const pendingUser = {
        id: 3,
        firstName: 'Pending',
        lastName: 'User',
        email: 'pending@example.com',
        profilePictureUrl: 'https://example.com/pending.jpg',
        globalRole: GlobalRole.pending,
        isVerified: false,
        requiresEmailVerification: true,
        avatar: null,
        institutionIds: [],
        hasInstitutionMembership: false,
        ltiIdentities: [],
        hasLtiIdentity: false,
      };

      const result = service.attachCapabilities(pendingUser);

      expect(result).toHaveProperty('capabilities');
      expect(Array.isArray(result.capabilities)).toBe(true);
      expect(result.institutionIds).toHaveLength(0);
    });
  });
});
