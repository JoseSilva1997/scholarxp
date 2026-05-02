// Verifies session guard accepts Passport-authenticated requests and rejects anonymous requests.
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { SessionAuthGuard } from './session-auth.guard';

describe('SessionAuthGuard', () => {
  const guard = new SessionAuthGuard();

  function contextFor(request: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('allows requests when Passport reports an authenticated session', () => {
    expect(
      guard.canActivate(
        contextFor({ isAuthenticated: jest.fn().mockReturnValue(true) }),
      ),
    ).toBe(true);
  });

  it('rejects requests when Passport reports an anonymous session', () => {
    expect(() =>
      guard.canActivate(
        contextFor({ isAuthenticated: jest.fn().mockReturnValue(false) }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects requests when session middleware has not attached Passport helpers', () => {
    expect(() => guard.canActivate(contextFor({}))).toThrow(
      UnauthorizedException,
    );
  });
});
