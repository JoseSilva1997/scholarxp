// CSRF helpers built on csrf-sync to keep setup centralized and testable.
import { csrfSync } from 'csrf-sync';

// We configure here so main.ts can consume named exports without repeating options.
const {
  csrfSynchronisedProtection: rawMiddleware,
  generateToken,
  invalidCsrfTokenError: rawInvalidCsrfTokenError,
} = csrfSync({
  // csrf-sync defaults to looking at x-csrf-token and the session secret; this aligns with current client.
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] as string | undefined,
  // Keep GET/HEAD/OPTIONS exempt; we log and handle skip logic in main.ts wrapper.
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  // Skip protection for logout to mirror previous csurf behavior and avoid double-destroy race conditions.
  skipCsrfProtection: (req) =>
    req.path === '/auth/logout' && req.method === 'POST',
  // Express-session already provides the store; csrf-sync uses req.session
});

// Narrow the exported shape so declaration emit does not pull in http-errors types.
export const invalidCsrfTokenError: Error =
  rawInvalidCsrfTokenError as unknown as Error;
export { generateToken };

// Wrap to keep type narrow for Nest/Express usage.
export const csrfSynchronisedProtection = rawMiddleware;
