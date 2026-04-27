// AuthService centralizes credential validation, OAuth linking, session hygiene, and user projection.
// We rely on Prisma for persistence and keep side effects (email, tokens) here for testability.
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, GlobalRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import type { Session, SessionData } from 'express-session';
import {
  listCapabilities,
  type FeatureKey,
  type Role as PermissionRole,
} from '@scholarxp/permissions';
import {
  getProgressWithinLevel,
  sanitizeEquippedCosmetics,
} from '@scholarxp/progression';
import { FRONTEND_URL } from '@scholarxp/constants';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationTokenService } from '../db-entities/email-verification-token/email-verification-token.service';
import { MailDeliveryError, MailerService } from '../mailer/mailer.service';
import { RegisterDto } from './dto/register.dto';
import type { AuthUser } from '../types/auth-user.type';
import type { GoogleProfile } from './strategies/google.strategy';
import { generateToken } from '../common/security/csrf';

type UserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  profilePictureUrl?: string | null;
  globalRole: GlobalRole;
  isVerified?: boolean;
  timezone?: string | null;
};

@Injectable()
export class AuthService {
  // Keep a scoped logger so we can correlate mail failures without leaking details to clients.
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTokens: EmailVerificationTokenService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  // --- Session helpers ---
  async regenerateSession(req: Request) {
    // Rotate session ID to prevent fixation; ignore existing auth state.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) =>
        err ? reject(new InternalServerErrorException(String(err))) : resolve(),
      );
    });
  }

  async loginUser(
    req: Request,
    user: AuthUser,
    options?: { persistSession?: Record<string, unknown> },
  ) {
    const persist = options?.persistSession ?? {};
    await this.regenerateSession(req);
    // Re-hydrate whitelisted session keys after regeneration so data captured before login survives.
    Object.entries(persist).forEach(([key, value]) => {
      // Session type lacks an index signature; cast through unknown to satisfy TS while keeping runtime safety.
      (req.session as unknown as Record<string, unknown>)[key] = value;
    });
    // Passport will call SessionSerializer.serializeUser via req.login.
    await new Promise<void>((resolve, reject) =>
      req.login(user, (err) =>
        err ? reject(new InternalServerErrorException(String(err))) : resolve(),
      ),
    );
  }

  async logout(req: Request, res?: Response) {
    await new Promise<void>((resolve) => req.logout(() => resolve()));
    // Preserve the old CSRF secret so the client can keep using its current token after logout.
    const previousSecret = (req.session as unknown as { csrfSecret?: string })
      .csrfSecret;
    // Regenerate instead of destroy so we immediately provide a fresh anonymous session + CSRF secret.
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) =>
        err ? reject(new InternalServerErrorException(String(err))) : resolve(),
      ),
    );
    // Reuse prior secret when available to avoid breaking the token the client already has; otherwise mint a new one via csrf-sync helper.
    if (previousSecret) {
      (req.session as unknown as { csrfSecret?: string }).csrfSecret =
        previousSecret;
    }
    const nextToken = generateToken(req);
    if (res) {
      res.setHeader('x-csrf-token', nextToken);
    }
    return nextToken;
  }

  // --- Local auth ---
  async register(dto: RegisterDto): Promise<AuthUser> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          globalRole: GlobalRole.pending,
        },
      });

      await tx.userPassword.create({
        data: { userId: createdUser.id, passwordHash },
      });

      await tx.authIdentity.create({
        data: {
          userId: createdUser.id,
          provider: AuthProvider.local,
          providerUserId: email,
          email,
        },
      });

      return createdUser;
    });

    const token = await this.emailTokens.issueToken({
      userId: user.id,
      reason: 'signup',
      reuseExisting: true,
    });
    await this.safeSendVerification(email, token.token);

    return this.toAuthUser(user, null, true);
  }

  async validateLocal(email: string, password: string): Promise<AuthUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordRow = await this.prisma.userPassword.findUnique({
      where: { userId: user.id },
    });
    if (!passwordRow) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, passwordRow.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    const avatar = await this.loadAvatarIfStudent(user);
    return this.toAuthUser(user, avatar);
  }

  async verifyEmail(token: string): Promise<AuthUser> {
    const record = await this.emailTokens.consumeToken(token);
    const user = await this.prisma.user.update({
      where: { id: record.userId },
      data: { isVerified: true },
    });
    const avatar = await this.loadAvatarIfStudent(user);
    return this.toAuthUser(user, avatar);
  }

  async resendVerification(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.isVerified) {
      return { sent: false, reason: 'already_verified' };
    }

    const token = await this.emailTokens.issueToken({
      userId: user.id,
      reason: 'signup',
      reuseExisting: false,
    });
    await this.safeSendVerification(normalizedEmail, token.token);
    return { sent: true };
  }

  // --- Google OAuth ---
  async loginWithGoogle(profile: GoogleProfile): Promise<AuthUser> {
    const payload = profile;

    const email = payload.email?.trim().toLowerCase() ?? null;
    if (!email) {
      throw new UnauthorizedException('Google account has no email');
    }
    const profilePictureUrl = payload.picture ?? 'default-profile-pic.png';

    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.google,
          providerUserId: payload.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingIdentity) {
      const refreshed = await this.refreshUserFromGoogle(
        existingIdentity.user,
        {
          email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          profilePictureUrl,
        },
      );
      const avatar = await this.loadAvatarIfStudent(refreshed);
      return this.toAuthUser(refreshed, avatar);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    const user = await this.linkOrCreateUserForGoogle(existingUser, {
      email,
      providerUserId: payload.providerUserId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      profilePictureUrl,
    });

    const avatar = await this.loadAvatarIfStudent(user);
    return this.toAuthUser(user, avatar);
  }

  // --- User loading and projection ---
  async getUserById(id: number): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('Session invalid');
    }
    const avatar = await this.loadAvatarIfStudent(user);
    return this.toAuthUser(user, avatar);
  }

  attachCapabilities(
    user: AuthUser,
  ): AuthUser & { capabilities: FeatureKey[] } {
    const capabilities = listCapabilities({
      role: user.globalRole as PermissionRole,
    });
    return { ...user, capabilities };
  }

  // --- CSRF ---
  // Surface a fresh CSRF token without writing to the response. Used by GET endpoints that hand the
  // token to anonymous clients in the body so they can post credentials.
  tryGenerateCsrfToken(req: Request): string | null {
    try {
      return generateToken(req);
    } catch {
      return null;
    }
  }

  // Set the rotating CSRF header on responses where the session may have been regenerated; returns
  // the token so callers can also include it in the body when convenient.
  attachCsrfHeader(req: Request, res: Response): string | null {
    const token = this.tryGenerateCsrfToken(req);
    if (token) {
      res.setHeader('x-csrf-token', token);
    }
    return token;
  }

  // --- Google OAuth callback orchestration ---
  // Narrow the passport-supplied req.user into our domain profile shape. Throw if the strategy
  // produced an unexpected payload so the controller never has to do runtime type checks.
  validateGoogleProfile(value: unknown): GoogleProfile {
    if (!value || typeof value !== 'object') {
      throw new UnauthorizedException('Google authentication failed');
    }
    const candidate = value as Partial<GoogleProfile>;
    if (
      candidate.provider !== 'google' ||
      typeof candidate.providerUserId !== 'string'
    ) {
      throw new UnauthorizedException('Google authentication failed');
    }
    return candidate as GoogleProfile;
  }

  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    // Capture redirect before login regenerates the session.
    const session = req.session as
      | (Session & Partial<SessionData> & { postAuthRedirect?: string })
      | undefined;
    const sessionRedirect =
      typeof session?.postAuthRedirect === 'string'
        ? session.postAuthRedirect
        : null;

    const profile = this.validateGoogleProfile(req.user);
    const user = await this.loginWithGoogle(profile);
    await this.loginUser(req, user, {
      persistSession: sessionRedirect
        ? { postAuthRedirect: sessionRedirect }
        : {},
    });
    if (session && 'postAuthRedirect' in session) {
      delete session.postAuthRedirect;
    }
    const redirectTarget = this.resolveOAuthRedirectTarget(
      process.env.CORS_ORIGIN ?? FRONTEND_URL,
      sessionRedirect,
    );
    res.redirect(redirectTarget);
  }

  private resolveOAuthRedirectTarget(
    baseOrigin: string,
    sessionRedirect?: string | null,
  ): string {
    // Some deployments provide a comma-separated list for CORS; pick the first and ensure we land on /main.
    const primaryOrigin = baseOrigin.split(',')[0]?.trim() ?? baseOrigin;
    const cleanedSessionRedirect =
      this.normalizeOAuthRedirectPath(sessionRedirect);
    try {
      const fallback = new URL('/main', primaryOrigin).toString();
      if (cleanedSessionRedirect) {
        return new URL(cleanedSessionRedirect, primaryOrigin).toString();
      }
      return fallback;
    } catch {
      // If the origin is malformed, fall back to a safe string concatenation while still targeting /main.
      const base = `${primaryOrigin.replace(/\/$/, '')}/main`;
      if (cleanedSessionRedirect) {
        return `${primaryOrigin.replace(/\/$/, '')}${cleanedSessionRedirect}`;
      }
      return base;
    }
  }

  private normalizeOAuthRedirectPath(
    sessionRedirect?: string | null,
  ): string | null {
    if (!sessionRedirect?.startsWith('/')) {
      return null;
    }
    try {
      const redirectUrl = new URL(sessionRedirect, 'https://scholarxp.local');
      if (this.isAuthRoute(redirectUrl.pathname)) {
        return null;
      }
      return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
    } catch {
      return null;
    }
  }

  private isAuthRoute(pathname: string): boolean {
    return (
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/verify-email'
    );
  }

  // --- Helpers ---
  private async refreshUserFromGoogle(
    user: UserRecord,
    incoming: {
      firstName: string;
      lastName: string;
      profilePictureUrl: string;
      email: string | null;
    },
  ) {
    const updates = this.buildGoogleProfileUpdates(user, incoming);
    if (Object.keys(updates).length === 0) {
      return user;
    }
    return this.prisma.user.update({ where: { id: user.id }, data: updates });
  }

  private async linkOrCreateUserForGoogle(
    existingUser: UserRecord | null,
    incoming: {
      email: string;
      providerUserId: string;
      firstName: string;
      lastName: string;
      profilePictureUrl: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const userRecord = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: this.buildGoogleProfileUpdates(existingUser, incoming),
          })
        : await tx.user.create({
            data: {
              email: incoming.email,
              firstName: incoming.firstName || '',
              lastName: incoming.lastName || '',
              profilePictureUrl: incoming.profilePictureUrl,
              globalRole: GlobalRole.pending,
              isVerified: true,
            },
          });

      await tx.authIdentity.create({
        data: {
          userId: userRecord.id,
          provider: AuthProvider.google,
          providerUserId: incoming.providerUserId,
          email: incoming.email,
        },
      });

      return userRecord;
    });
  }

  private buildGoogleProfileUpdates(
    user: UserRecord,
    incoming: {
      firstName: string;
      lastName: string;
      profilePictureUrl: string;
      email: string | null;
    },
  ): Prisma.UserUpdateInput {
    const updates: Prisma.UserUpdateInput = {};
    if (incoming.firstName && incoming.firstName !== user.firstName) {
      updates.firstName = incoming.firstName;
    }
    if (incoming.lastName && incoming.lastName !== user.lastName) {
      updates.lastName = incoming.lastName;
    }
    if (
      incoming.profilePictureUrl &&
      incoming.profilePictureUrl !== user.profilePictureUrl
    ) {
      updates.profilePictureUrl = incoming.profilePictureUrl;
    }
    if (!user.email && incoming.email) {
      updates.email = incoming.email;
    }
    return updates;
  }

  private async loadAvatarIfStudent(user: {
    id: number;
    globalRole: GlobalRole;
  }) {
    if (user.globalRole !== GlobalRole.student) {
      return null;
    }
    return this.prisma.avatar.findUnique({
      where: { userId: user.id },
      select: { id: true, totalExp: true, equippedCosmetics: true },
    });
  }

  private toAuthUser(
    user: {
      id: number;
      firstName: string;
      lastName: string;
      email: string | null;
      profilePictureUrl?: string | null;
      globalRole: GlobalRole;
      isVerified?: boolean;
      timezone?: string | null;
    },
    avatar?: {
      id: number;
      totalExp: number;
      equippedCosmetics?: unknown;
    } | null,
    requireVerification?: boolean,
  ): AuthUser {
    // Sanitize the persisted JSON blob against the user's current level so stale or tampered entries
    // never reach the UI. The client treats this as a plain read with no further validation.
    const progress = avatar ? getProgressWithinLevel(avatar.totalExp) : null;
    const mappedAvatar =
      avatar && progress
        ? {
            id: avatar.id,
            totalExp: avatar.totalExp,
            ...progress,
            equippedCosmetics: sanitizeEquippedCosmetics(
              avatar.equippedCosmetics,
              progress.level,
            ),
          }
        : null;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl ?? 'default-profile-pic.png',
      globalRole: user.globalRole,
      isVerified: user.isVerified ?? false,
      timezone: user.timezone ?? 'UTC',
      // Caller can flag that email verification is still pending for UX hints.
      requiresEmailVerification:
        requireVerification || !(user.isVerified ?? false),
      avatar: mappedAvatar,
    } as AuthUser;
  }

  // Wrap verification email dispatch to catch transport failures and log them internally
  // without surfacing details to the frontend. This prevents leaking SMTP errors to clients
  // (e.g., SES sandbox rejections, non-existent email addresses) while allowing backend monitoring.
  private async safeSendVerification(email: string, code: string) {
    try {
      await this.mailer.sendVerificationCode(email, code);
    } catch (error) {
      if (error instanceof MailDeliveryError) {
        // Log the transport error with full context for backend monitoring and debugging.
        this.logger.warn('Email delivery failed', {
          reason: 'MailDeliveryError',
          details: error.details,
          email,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Log unexpected errors with stack for investigation.
        this.logger.error('Unexpected email delivery failure', {
          reason: (error as Error)?.message,
          stack: (error as Error)?.stack,
          email,
          timestamp: new Date().toISOString(),
        });
      }
      // Gracefully return without throwing—the frontend doesn't need to know the email failed.
      // This improves UX by not exposing email validation or delivery issues.
    }
  }
}
