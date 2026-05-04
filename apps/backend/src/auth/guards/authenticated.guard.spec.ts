// Verifies authenticated guard behavior for session-aware routes.
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticatedGuard } from './authenticated.guard';

describe('AuthenticatedGuard', () => {
  const guard = new AuthenticatedGuard();

  function contextFor(request: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('allows authenticated Passport sessions', () => {
    expect(
      guard.canActivate(
        contextFor({ isAuthenticated: jest.fn().mockReturnValue(true) }),
      ),
    ).toBe(true);
  });

  it('rejects unauthenticated Passport sessions', () => {
    expect(() =>
      guard.canActivate(
        contextFor({ isAuthenticated: jest.fn().mockReturnValue(false) }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects requests missing Passport session helpers', () => {
    expect(() => guard.canActivate(contextFor({}))).toThrow(
      UnauthorizedException,
    );
  });
});
