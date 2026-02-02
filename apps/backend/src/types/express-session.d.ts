import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    // Stored by csrf-sync to bind token generation/verification to the session.
    csrfSecret?: string;
  }
}
