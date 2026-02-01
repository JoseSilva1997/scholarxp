// Google OAuth strategy: handles OAuth handshake; AuthService owns user linking logic.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

// Minimal profile shape we pass onward; richer handling is in AuthService.
export type GoogleProfile = {
  provider: 'google';
  providerUserId: string;
  email: string | null;
  firstName: string;
  lastName: string;
  picture?: string;
  state?: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['openid', 'email', 'profile'],
      passReqToCallback: true,
      state: true, // enable OAuth state to mitigate CSRF
    });
  }

  validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    // Keep mapping minimal; business rules and persistence live in AuthService.
    const mapped: GoogleProfile = {
      provider: 'google',
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value?.toLowerCase() ?? null,
      firstName: profile.name?.givenName ?? '',
      lastName: profile.name?.familyName ?? '',
      picture: profile.photos?.[0]?.value ?? undefined,
      state: (req.query.state as string | undefined) ?? undefined,
    };
    done(null, mapped);
  }
}
