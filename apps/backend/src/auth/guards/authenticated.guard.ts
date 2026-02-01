// AuthenticatedGuard ensures requests have a Passport-authenticated user in the session.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    // Passport adds isAuthenticated when session middleware is present.
    if (req.isAuthenticated && req.isAuthenticated()) {
      return true;
    }
    throw new UnauthorizedException('Authentication required');
  }
}
