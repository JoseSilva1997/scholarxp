// Guard to capture the desired post-auth redirect (e.g., /invite?token=...) before OAuth redirects.
// It stores the redirect value in the session so it survives the external OAuth round-trip.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Session, SessionData } from 'express-session';

@Injectable()
export class CaptureRedirectGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const session = req.session as
      | (Session & Partial<SessionData> & { postAuthRedirect?: string })
      | undefined;
    const redirectParam =
      typeof req.query.redirect === 'string' ? req.query.redirect : null;
    if (session && redirectParam) {
      // Persist the redirect so we can honor it after the OAuth callback and session regeneration.
      session.postAuthRedirect = redirectParam;
    }
    return true;
  }
}
