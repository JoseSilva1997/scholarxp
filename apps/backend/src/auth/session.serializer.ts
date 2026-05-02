// SessionSerializer bridges Passport sessions to our AuthUser projection.
// It keeps the session payload lean (only user ID) and reloads fresh user data per request.
import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { AuthUser } from '@scholarxp/api-contracts';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  // Called by Passport during req.login after successful authentication; the value handed to
  // `done` is what gets persisted in the session store.
  serializeUser(user: AuthUser, done: (err: unknown, id?: number) => void) {
    // Store only the user ID in the session to keep cookies small and invalidate on user changes.
    done(null, user.id);
  }

  // Called by Passport on every authenticated request to rehydrate req.user from the persisted ID.
  // Re-fetching ensures role/profile changes take effect without forcing the user to log out.
  async deserializeUser(
    id: number,
    done: (err: unknown, user?: AuthUser | false) => void,
  ) {
    try {
      const user = await this.authService.getUserById(id);
      done(null, user);
    } catch (error) {
      // Returning false signals Passport to treat the session as invalid.
      done(error, false);
    }
  }
}
