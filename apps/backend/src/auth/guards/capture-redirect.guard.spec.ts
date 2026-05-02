// Verifies OAuth redirect capture only persists a valid string redirect into the session.
import type { ExecutionContext } from '@nestjs/common';
import { CaptureRedirectGuard } from './capture-redirect.guard';

describe('CaptureRedirectGuard', () => {
  const guard = new CaptureRedirectGuard();

  function buildContext(request: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('stores a string redirect in the session and allows the request', () => {
    const session: { postAuthRedirect?: string } = {};
    const request = {
      query: { redirect: '/invite?token=abc' },
      session,
    };

    const result = guard.canActivate(buildContext(request));

    expect(result).toBe(true);
    expect(session.postAuthRedirect).toBe('/invite?token=abc');
  });

  it('ignores array redirects because Express query parsing can produce non-strings', () => {
    const session: { postAuthRedirect?: string } = {};
    const request = {
      query: { redirect: ['/safe', '/other'] },
      session,
    };

    const result = guard.canActivate(buildContext(request));

    expect(result).toBe(true);
    expect(session.postAuthRedirect).toBeUndefined();
  });

  it('allows requests without a session', () => {
    const request = {
      query: { redirect: '/profile' },
    };

    expect(guard.canActivate(buildContext(request))).toBe(true);
  });
});
