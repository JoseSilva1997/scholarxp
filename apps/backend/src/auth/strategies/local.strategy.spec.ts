// Verifies LocalStrategy delegates credential validation to AuthService without duplicating auth rules.
import { Test, type TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { AuthService } from '../auth.service';
import { LocalStrategy } from './local.strategy';
import type { AuthUser } from '@scholarxp/api-contracts';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: { validateLocal: jest.Mock };

  const user: AuthUser = {
    id: 3,
    firstName: 'Linus',
    lastName: 'Pauling',
    email: 'linus@example.com',
    profilePictureUrl: null,
    globalRole: GlobalRole.student,
    isVerified: true,
    requiresEmailVerification: false,
    avatar: null,
    timezone: 'UTC',
  };

  beforeEach(async () => {
    authService = {
      validateLocal: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = moduleRef.get(LocalStrategy);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the AuthService user for valid credentials', async () => {
    authService.validateLocal.mockResolvedValue(user);

    const result = await strategy.validate('linus@example.com', 'secret');

    expect(authService.validateLocal).toHaveBeenCalledWith(
      'linus@example.com',
      'secret',
    );
    expect(result).toBe(user);
  });

  it('propagates credential validation failures from AuthService', async () => {
    authService.validateLocal.mockRejectedValue(new Error('invalid login'));

    await expect(strategy.validate('linus@example.com', 'bad')).rejects.toThrow(
      'invalid login',
    );
  });
});
