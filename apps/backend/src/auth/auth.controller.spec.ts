// Unit tests for AuthController covering happy path, unhappy path, and basis path scenarios
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import type { AuthUser } from '../types/auth-user.type';
import type { Request, Response } from 'express';
import { GlobalRole } from '@prisma/client';
import type { FeatureKey } from '@scholarxp/permissions';
import { FRONTEND_URL } from '@scholarxp/constants';
import { generateToken } from '../common/security/csrf';

jest.mock('../common/security/csrf', () => ({
  generateToken: jest.fn(),
}));

// Comprehensive unit tests for AuthController with happy path, unhappy path, and basis path coverage
describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  // Mock user object represents fully authenticated user with all properties
  const mockAuthUser: AuthUser = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    profilePictureUrl: 'https://example.com/pic.jpg',
    globalRole: GlobalRole.student,
    isVerified: true,
    requiresEmailVerification: false,
    avatar: { id: 1, level: 5, currentExp: 1000 },
    institutionIds: [1],
    hasInstitutionMembership: true,
    ltiIdentities: [{ institutionId: 1, ltiUserId: 'lti-user-1' }],
    hasLtiIdentity: true,
  };

  // attachCapabilities returns the same user object with computed capabilities array
  const mockCapabilities: FeatureKey[] = [];
  const _mockUserWithCapabilities = {
    ...mockAuthUser,
    capabilities: mockCapabilities,
  };

  beforeEach(async () => {
    // Create mocks for AuthService
    const authServiceMock = {
      register: jest.fn(),
      regenerateSession: jest.fn(),
      attachCapabilities: jest.fn(),
      loginUser: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
      logout: jest.fn(),
      loginWithGoogle: jest.fn(),
    };

    // Mock guards to avoid dependency resolution issues (ThrottlerGuard and AuthenticatedGuard require external modules)
    const mockThrottlerGuard = {
      canActivate: jest.fn(() => true),
    };

    const mockAuthenticatedGuard = {
      canActivate: jest.fn(() => true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(mockThrottlerGuard)
      .overrideGuard(AuthenticatedGuard)
      .useValue(mockAuthenticatedGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    // ===== HAPPY PATH =====
    it('should register new user and return pending email verification', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'Password123!',
      } as RegisterDto;

      const unverifiedUser: AuthUser = {
        ...mockAuthUser,
        isVerified: false,
        requiresEmailVerification: true,
      };
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.register.mockResolvedValue(unverifiedUser);
      authService.regenerateSession.mockResolvedValue(undefined);
      authService.attachCapabilities.mockReturnValue({
        ...unverifiedUser,
        capabilities: mockCapabilities,
      });

      const result = await controller.register(registerDto, mockReq, mockRes);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(authService.regenerateSession).toHaveBeenCalledWith(mockReq);
      expect(result.pendingEmailVerification).toBe(true);
      expect(result.user.email).toBe(unverifiedUser.email);
    });

    // ===== UNHAPPY PATH =====
    it('should propagate register error if email already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'Password123!',
      } as RegisterDto;

      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.register.mockRejectedValue(new Error('Email already in use'));

      await expect(
        controller.register(registerDto, mockReq, mockRes),
      ).rejects.toThrow('Email already in use');
    });

    // ===== BASIS PATH =====
    it('should handle registration error and not call regenerateSession', async () => {
      const registerDto = {
        email: 'error@example.com',
        firstName: 'Error',
        lastName: 'User',
        password: 'Password123!',
      } as RegisterDto;

      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.register.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.register(registerDto, mockReq, mockRes),
      ).rejects.toThrow('Database error');
      expect(authService.regenerateSession).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    // ===== HAPPY PATH =====
    it('should login user and attach capabilities', async () => {
      const mockReq = {
        user: mockAuthUser,
        headers: {},
        csrfToken: jest.fn(() => 'csrf-token-123'),
      } as unknown as Request;
      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn(),
      } as unknown as Response;

      authService.loginUser.mockResolvedValue(undefined);
      authService.attachCapabilities.mockReturnValue({
        ...mockAuthUser,
        capabilities: mockCapabilities,
      } as any);

      const result = await controller.login(mockReq, mockRes);

      expect(authService.loginUser).toHaveBeenCalledWith(mockReq, mockAuthUser);
      expect(authService.attachCapabilities).toHaveBeenCalledWith(mockAuthUser);
      expect(result.user.id).toBe(mockAuthUser.id);
      expect(result.user.email).toBe(mockAuthUser.email);
    });

    // ===== UNHAPPY PATH =====
    it('should propagate loginUser error if session setup fails', async () => {
      const mockReq = {
        user: mockAuthUser,
        headers: {},
        csrfToken: jest.fn(() => 'csrf-token-123'),
      } as unknown as Request;
      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn(),
      } as unknown as Response;

      authService.loginUser.mockRejectedValue(new Error('Session error'));

      await expect(controller.login(mockReq, mockRes)).rejects.toThrow(
        'Session error',
      );
    });

    // ===== BASIS PATH =====
    it('should still attach capabilities even if user data is minimal', async () => {
      const minimalUser: AuthUser = {
        id: 2,
        firstName: 'Min',
        lastName: 'User',
        email: null,
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.pending,
        isVerified: false,
        requiresEmailVerification: true,
        avatar: null,
        institutionIds: [],
        hasInstitutionMembership: false,
        ltiIdentities: [],
        hasLtiIdentity: false,
      };

      const mockReq = {
        user: minimalUser,
        headers: {},
        csrfToken: jest.fn(() => 'csrf-token-123'),
      } as unknown as Request;
      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn(),
      } as unknown as Response;

      authService.loginUser.mockResolvedValue(undefined);
      authService.attachCapabilities.mockReturnValue({
        ...minimalUser,
        capabilities: [],
      });

      const result = await controller.login(mockReq, mockRes);

      expect(result.user.id).toBe(minimalUser.id);
      expect(result.user.capabilities).toEqual([]);
    });
  });

  describe('verifyEmail', () => {
    // ===== HAPPY PATH =====
    it('should verify email and login user', async () => {
      const verifyDto = { token: 'valid-token' } as VerifyEmailDto;
      const verifiedUser: AuthUser = {
        ...mockAuthUser,
        isVerified: true,
        requiresEmailVerification: false,
      };
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.verifyEmail.mockResolvedValue(verifiedUser);
      authService.loginUser.mockResolvedValue(undefined);
      authService.attachCapabilities.mockReturnValue({
        ...verifiedUser,
        capabilities: mockCapabilities,
      });

      const result = await controller.verifyEmail(verifyDto, mockReq, mockRes);

      expect(authService.verifyEmail).toHaveBeenCalledWith(verifyDto.token);
      expect(authService.loginUser).toHaveBeenCalledWith(mockReq, verifiedUser);
      expect(result.user.isVerified).toBe(true);
    });

    // ===== UNHAPPY PATH =====
    it('should throw error if token is invalid', async () => {
      const verifyDto = { token: 'invalid-token' } as VerifyEmailDto;
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.verifyEmail.mockRejectedValue(new Error('Token expired'));

      await expect(
        controller.verifyEmail(verifyDto, mockReq, mockRes),
      ).rejects.toThrow('Token expired');
      expect(authService.loginUser).not.toHaveBeenCalled();
    });

    // ===== BASIS PATH =====
    it('should not login user if verifyEmail fails before loginUser is called', async () => {
      const verifyDto = { token: 'bad-token' } as VerifyEmailDto;
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.verifyEmail.mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      await expect(
        controller.verifyEmail(verifyDto, mockReq, mockRes),
      ).rejects.toThrow('Invalid token');
      expect(authService.loginUser).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    // ===== HAPPY PATH =====
    it('should resend verification email for unverified user', async () => {
      const resendDto = {
        email: 'unverified@example.com',
      } as ResendVerificationDto;
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.resendVerification.mockResolvedValue({ sent: true });

      const result = await controller.resendVerification(
        resendDto,
        mockReq,
        mockRes,
      );

      expect(authService.resendVerification).toHaveBeenCalledWith(
        resendDto.email,
      );
      expect(result.sent).toBe(true);
    });

    // ===== BASIS PATH =====
    it('should return already_verified when email is already verified', async () => {
      const resendDto = {
        email: 'verified@example.com',
      } as ResendVerificationDto;
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.resendVerification.mockResolvedValue({
        sent: false,
        reason: 'already_verified',
      });

      const result = await controller.resendVerification(
        resendDto,
        mockReq,
        mockRes,
      );

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('already_verified');
    });

    // ===== UNHAPPY PATH =====
    it('should propagate error if user not found', async () => {
      const resendDto = {
        email: 'nonexistent@example.com',
      } as ResendVerificationDto;
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      authService.resendVerification.mockRejectedValue(
        new UnauthorizedException('User not found'),
      );

      await expect(
        controller.resendVerification(resendDto, mockReq, mockRes),
      ).rejects.toThrow('User not found');
    });
  });

  describe('logout', () => {
    // ===== HAPPY PATH =====
    it('should logout user and clear session', async () => {
      const mockReq = {
        isAuthenticated: jest.fn(() => true),
      } as unknown as Request;
      const mockRes = {
        setHeader: jest.fn(),
      } as unknown as Response;

      // authService.logout returns the CSRF token
      authService.logout.mockResolvedValue('csrf-token-123');

      const result = await controller.logout(mockReq, mockRes);

      expect(authService.logout).toHaveBeenCalledWith(mockReq, mockRes);
      expect(result).toEqual({ ok: true, csrfToken: 'csrf-token-123' });
    });

    // ===== UNHAPPY PATH =====
    it('should propagate logout error', async () => {
      const mockReq = {
        isAuthenticated: jest.fn(() => true),
      } as unknown as Request;
      const mockRes = {
        setHeader: jest.fn(),
      } as unknown as Response;

      authService.logout.mockRejectedValue(new Error('Session destroy failed'));

      await expect(controller.logout(mockReq, mockRes)).rejects.toThrow(
        'Session destroy failed',
      );
    });

    // ===== BASIS PATH =====
    it('should still return ok response after successful logout', async () => {
      const mockReq = {
        isAuthenticated: jest.fn(() => false),
      } as unknown as Request;
      const mockRes = {
        setHeader: jest.fn(),
      } as unknown as Response;

      // authService.logout returns the CSRF token directly
      authService.logout.mockResolvedValue('csrf-token-456');

      const result = await controller.logout(mockReq, mockRes);

      expect(result).toEqual({ ok: true, csrfToken: 'csrf-token-456' });
    });
  });

  describe('me', () => {
    // ===== HAPPY PATH =====
    it('should return authenticated user with capabilities', () => {
      const mockReq = { user: mockAuthUser } as unknown as Request;

      authService.attachCapabilities.mockReturnValue({
        ...mockAuthUser,
        capabilities: mockCapabilities,
      });

      const result = controller.me(mockReq);

      expect(authService.attachCapabilities).toHaveBeenCalledWith(mockAuthUser);
      expect(result.user!.id).toBe(mockAuthUser.id);
      expect(result.user!.capabilities).toEqual(mockCapabilities);
    });

    // ===== UNHAPPY PATH =====
    it('should return null user when not authenticated', () => {
      const mockReq = {} as Request;

      const result = controller.me(mockReq);

      expect(result.user).toBeNull();
      expect(authService.attachCapabilities).not.toHaveBeenCalled();
    });

    // ===== BASIS PATH =====
    it('should handle user with undefined', () => {
      const mockReq = { user: undefined } as unknown as Request;

      const result = controller.me(mockReq);

      expect(result.user).toBeNull();
      expect(authService.attachCapabilities).not.toHaveBeenCalled();
    });
  });

  describe('csrf', () => {
    // ===== HAPPY PATH =====
    it('should return CSRF token when available', () => {
      const csrfToken = 'csrf-token-xyz';
      (generateToken as jest.Mock).mockReturnValueOnce(csrfToken);
      const mockReq = {} as Request;

      const result = controller.csrf(mockReq);

      expect(result.csrfToken).toBe(csrfToken);
    });

    // ===== UNHAPPY PATH =====
    it('should return null when csrfToken is not available', () => {
      (generateToken as jest.Mock).mockImplementationOnce(() => {
        throw new Error('fail');
      });
      const mockReq = {} as Request;

      const result = controller.csrf(mockReq);

      expect(result.csrfToken).toBeNull();
    });
  });

  describe('googleAuth', () => {
    // ===== HAPPY PATH =====
    it('should return ok response for Google auth redirect', () => {
      const result = controller.googleAuth();

      expect(result).toEqual({ ok: true });
    });
  });

  describe('googleCallback', () => {
    // ===== HAPPY PATH =====
    it('should login user and redirect to frontend on successful Google auth', async () => {
      const mockReq = { user: mockAuthUser } as unknown as Request;
      const mockRes = { redirect: jest.fn() } as unknown as Response;

      authService.loginWithGoogle.mockResolvedValue(mockAuthUser);
      authService.loginUser.mockResolvedValue(undefined);

      process.env.CORS_ORIGIN = 'https://app.example.com';

      await controller.googleCallback(mockReq, mockRes);

      expect(authService.loginWithGoogle).toHaveBeenCalledWith(mockAuthUser);
      // loginUser is called with req, user, and options object for session persistence.
      expect(authService.loginUser).toHaveBeenCalledWith(
        mockReq,
        mockAuthUser,
        { persistSession: {} },
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'https://app.example.com/main',
      );
    });

    // ===== UNHAPPY PATH =====
    it('should not redirect if loginWithGoogle fails', async () => {
      const mockReq = { user: mockAuthUser } as unknown as Request;
      const mockRes = { redirect: jest.fn() } as unknown as Response;

      authService.loginWithGoogle.mockRejectedValue(
        new UnauthorizedException('Invalid Google user'),
      );

      await expect(controller.googleCallback(mockReq, mockRes)).rejects.toThrow(
        'Invalid Google user',
      );
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    // ===== BASIS PATH =====
    it('should redirect to default FRONTEND_URL when CORS_ORIGIN is not set', async () => {
      const mockReq = { user: mockAuthUser } as unknown as Request;
      const mockRes = { redirect: jest.fn() } as unknown as Response;

      authService.loginWithGoogle.mockResolvedValue(mockAuthUser);
      authService.loginUser.mockResolvedValue(undefined);

      delete process.env.CORS_ORIGIN;

      await controller.googleCallback(mockReq, mockRes);

      // Should redirect to FRONTEND_URL constant
      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl).toBe(`${FRONTEND_URL}/main`);
    });

    it('should handle loginUser error and not redirect', async () => {
      const mockReq = { user: mockAuthUser } as unknown as Request;
      const mockRes = { redirect: jest.fn() } as unknown as Response;

      authService.loginWithGoogle.mockResolvedValue(mockAuthUser);
      authService.loginUser.mockRejectedValue(
        new Error('Session setup failed'),
      );

      await expect(controller.googleCallback(mockReq, mockRes)).rejects.toThrow(
        'Session setup failed',
      );
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });
});
