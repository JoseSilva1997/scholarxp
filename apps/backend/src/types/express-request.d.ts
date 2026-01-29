// Extends Express Request to carry the hydrated AuthUser added by SessionAuthGuard.
import type { AuthUser } from '../auth/auth.service';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
