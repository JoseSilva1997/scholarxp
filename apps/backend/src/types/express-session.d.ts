import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}
// Augment express-session with our CSRF secret so TypeScript recognizes the field set by csurf.
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfSecret?: string;
  }
}
