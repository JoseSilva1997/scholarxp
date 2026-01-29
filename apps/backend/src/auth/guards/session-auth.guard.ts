// SessionAuthGuard ensures requests carry a valid session user; it eagerly loads the AuthUser
// so downstream handlers/guards can rely on a typed req.user without re-querying.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { Request } from 'express';
import type { AuthUser } from '../../types/auth-user.type';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.session?.userId;
    if (!userId) {
      // Reject early when no session is present to avoid extra database work.
      throw new UnauthorizedException('Authentication required');
    }

    // Fetch the canonical AuthUser shape so controllers and other guards share one source of truth.
    const user: AuthUser = await this.authService.getUserById(userId);
    req.user = user;
    return true;
  }
}
