// Verifies GoogleStrategy maps Passport profile data into the minimal auth profile contract.
import { ConfigService } from '@nestjs/config';
import type { Profile, VerifyCallback } from 'passport-google-oauth20';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(() => {
    const config = {
      getOrThrow: jest.fn((key: string) => `test-${key}`),
    } as unknown as ConfigService;

    strategy = new GoogleStrategy(config);
  });

  it('maps a complete Google profile and lowercases the email', () => {
    const done = jest.fn() as jest.MockedFunction<VerifyCallback>;
    const profile = {
      id: 'google-user-1',
      emails: [{ value: 'STUDENT@EXAMPLE.COM' }],
      name: { givenName: 'Ada', familyName: 'Lovelace' },
      photos: [{ value: 'https://example.com/photo.png' }],
    } as Profile;

    strategy.validate(
      { query: { state: 'state-token' } } as never,
      'access',
      'refresh',
      profile,
      done,
    );

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerUserId: 'google-user-1',
      email: 'student@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      picture: 'https://example.com/photo.png',
      state: 'state-token',
    });
  });

  it('uses safe defaults when optional profile fields are absent', () => {
    const done = jest.fn() as jest.MockedFunction<VerifyCallback>;
    const profile = {
      id: 'google-user-2',
    } as Profile;

    strategy.validate(
      { query: {} } as never,
      'access',
      'refresh',
      profile,
      done,
    );

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerUserId: 'google-user-2',
      email: null,
      firstName: '',
      lastName: '',
      picture: undefined,
      state: undefined,
    });
  });
});
