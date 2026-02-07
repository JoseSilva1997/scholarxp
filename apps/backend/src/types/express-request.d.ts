// Extends Express Request to carry the hydrated AuthUser added by SessionAuthGuard.
import type { AuthUser } from './auth-user.type';

declare module 'express-serve-static-core' {
  interface Request {
    // Request-scoped correlation id used to stitch logs and client error reports together.
    requestId?: string;
    user?: AuthUser;
  }
}
