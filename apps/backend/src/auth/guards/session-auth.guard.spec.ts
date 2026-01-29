// Tests for SessionAuthGuard to ensure it enforces session presence and attaches AuthUser.
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { SessionAuthGuard } from './session-auth.guard';
import { AuthService } from '../auth.service';
import type { AuthUser } from '../../types/auth-user.type';

describe('SessionAuthGuard', () => {
  let guard: SessionAuthGuard;
  let authService: { getUserById: jest.Mock };

  beforeEach(() => {
    authService = {
      // Mocked to avoid DB calls while keeping return shape identical to production.
      getUserById: jest.fn(),
    };
    guard = new SessionAuthGuard(authService as unknown as AuthService);
  });

  const createContext = (req: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as unknown as ExecutionContext;

  it('attaches the AuthUser when session contains a userId', async () => {
    const user: AuthUser = {
      id: 7,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      profilePictureUrl: 'pic.png',
      globalRole: GlobalRole.teacher,
      isVerified: true,
      avatar: null,
    };
    authService.getUserById.mockResolvedValue(user);
    const req: any = { session: { userId: user.id } };

    const result = await guard.canActivate(createContext(req));

    expect(result).toBe(true);
    expect(authService.getUserById).toHaveBeenCalledWith(user.id);
    expect(req.user).toEqual(user);
  });

  it('throws UnauthorizedException when no session userId exists', async () => {
    const req: any = { session: {} };

    await expect(guard.canActivate(createContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.getUserById).not.toHaveBeenCalled();
  });

  it('propagates UnauthorizedException from authService when session is invalid', async () => {
    const req: any = { session: { userId: 99 } };
    authService.getUserById.mockRejectedValue(
      new UnauthorizedException('Session invalid'),
    );

    await expect(guard.canActivate(createContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.getUserById).toHaveBeenCalledWith(99);
  });
});
