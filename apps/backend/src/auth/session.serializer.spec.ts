// Verifies Passport session serialization keeps stored state small and reloads users through AuthService.
import { Test, type TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { SessionSerializer } from './session.serializer';
import type { AuthUser } from '../types/auth-user.type';

describe('SessionSerializer', () => {
  let serializer: SessionSerializer;
  let authService: { getUserById: jest.Mock };

  const user: AuthUser = {
    id: 12,
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    profilePictureUrl: null,
    globalRole: GlobalRole.student,
    isVerified: true,
    requiresEmailVerification: false,
    avatar: null,
    timezone: 'UTC',
  };

  beforeEach(async () => {
    authService = {
      getUserById: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SessionSerializer,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    serializer = moduleRef.get(SessionSerializer);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('serializes only the user id into the session', () => {
    const done = jest.fn();

    serializer.serializeUser(user, done);

    expect(done).toHaveBeenCalledWith(null, user.id);
  });

  it('deserializes a session id into the current auth user', async () => {
    const done = jest.fn();
    authService.getUserById.mockResolvedValue(user);

    await serializer.deserializeUser(user.id, done);

    expect(authService.getUserById).toHaveBeenCalledWith(user.id);
    expect(done).toHaveBeenCalledWith(null, user);
  });

  it('returns false to Passport when session deserialization fails', async () => {
    const done = jest.fn();
    const error = new Error('missing user');
    authService.getUserById.mockRejectedValue(error);

    await serializer.deserializeUser(user.id, done);

    expect(done).toHaveBeenCalledWith(error, false);
  });
});
