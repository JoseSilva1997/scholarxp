// LocalStrategy validates email/password logins via AuthService while keeping Passport glue minimal.
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import type { AuthUser } from '../../types/auth-user.type';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    // Explicitly map the username field to email to avoid surprises.
    super({ usernameField: 'email', passwordField: 'password', session: true });
  }

  async validate(email: string, password: string): Promise<AuthUser> {
    // Delegate to AuthService so all credential logic lives in one place.
    return this.authService.validateLocal(email, password);
  }
}
