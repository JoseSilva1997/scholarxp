// Google OAuth strategy: handles user lookup/creation based on Google profile data.
// We keep logic minimal here and defer to AuthService for user creation/linking rules.
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ??
        'http://localhost:3000/auth/oauth/google/callback',
      scope: ['openid', 'email', 'profile'],
      passReqToCallback: true,
    });
  }

  // We keep the verify step tiny; actual user handling lives in AuthService.loginWithGoogle.
  validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const intent = (req.query.intent as string | undefined) ?? 'login';
    const email = profile.emails?.[0]?.value?.toLowerCase() ?? null;
    const firstName = profile.name?.givenName ?? '';
    const lastName = profile.name?.familyName ?? '';
    const picture = profile.photos?.[0]?.value ?? undefined;
    done(null, {
      provider: 'google',
      providerUserId: profile.id,
      email,
      firstName,
      lastName,
      picture,
      intent,
    });
  }
}
