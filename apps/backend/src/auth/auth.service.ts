// AuthService centralizes credential validation, OAuth linking, session hygiene, and user projection.
// We rely on Prisma for persistence and keep side effects (email, tokens) here for testability.
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, GlobalRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import {
  listCapabilities,
  type FeatureKey,
  type Role as PermissionRole,
} from '@scholarxp/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationTokenService } from '../db-entities/email-verification-token/email-verification-token.service';
import { MailerService } from '../mailer/mailer.service';
import { RegisterDto } from './dto/register.dto';
import type { AuthUser } from '../types/auth-user.type';
import type { GoogleProfile } from './strategies/google.strategy';

type UserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  profilePictureUrl?: string | null;
  globalRole: GlobalRole;
  isVerified?: boolean;
};

@Injectable()
export class AuthService {
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
        err ? reject(new Error(String(err))) : resolve(),
      );
    });
  }

  async loginUser(req: Request, user: AuthUser) {
    await this.regenerateSession(req);
    // Passport will call SessionSerializer.serializeUser via req.login.
    await new Promise<void>((resolve, reject) =>
      req.login(user, (err) =>
        err ? reject(new Error(String(err))) : resolve(),
      ),
    );
  }

  async logout(req: Request, res?: Response) {
    await new Promise<void>((resolve) => req.logout(() => resolve()));
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((err) =>
        err ? reject(new Error(String(err))) : resolve(),
      ),
    );
    // Clear cookie to remove residual client state; mirror session cookie options.
    const isProd = this.config.get('NODE_ENV') === 'production';
    if (res) {
      res.clearCookie('connect.sid', {
        httpOnly: true,
        sameSite: isProd ? 'none' : 'lax',
        secure: isProd,
      });
    }
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
    await this.mailer.sendVerificationCode(email, token.token);

    return this.toAuthUser(user, null, undefined, true);
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
    const membership = await this.loadInstitutionMembership(user.id);
    return this.toAuthUser(user, avatar, membership);
  }

  async verifyEmail(token: string): Promise<AuthUser> {
    const record = await this.emailTokens.consumeToken(token);
    const user = await this.prisma.user.update({
      where: { id: record.userId },
      data: { isVerified: true },
    });
    const avatar = await this.loadAvatarIfStudent(user);
    const membership = await this.loadInstitutionMembership(user.id);
    return this.toAuthUser(user, avatar, membership);
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
    await this.mailer.sendVerificationCode(normalizedEmail, token.token);
    return { sent: true };
  }

  // --- Google OAuth ---
  async loginWithGoogle(profile: any): Promise<AuthUser> {
    const payload = profile as GoogleProfile;

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
      const membership = await this.loadInstitutionMembership(refreshed.id);
      return this.toAuthUser(refreshed, avatar, membership);
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
    const membership = await this.loadInstitutionMembership(user.id);
    return this.toAuthUser(user, avatar, membership);
  }

  // --- User loading and projection ---
  async getUserById(id: number): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('Session invalid');
    }
    const avatar = await this.loadAvatarIfStudent(user);
    const membership = await this.loadInstitutionMembership(user.id);
    return this.toAuthUser(user, avatar, membership);
  }

  attachCapabilities(
    user: AuthUser,
  ): AuthUser & { capabilities: FeatureKey[] } {
    const capabilities = listCapabilities({
      role: user.globalRole as PermissionRole,
      hasInstitutionMembership: user.hasInstitutionMembership,
    });
    return { ...user, capabilities };
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

  private async loadInstitutionMembership(userId: number) {
    const firstIdentity = await this.prisma.ltiIdentity.findFirst({
      where: { userId },
      select: { institutionId: true, ltiUserId: true },
    });

    if (!firstIdentity) {
      return {
        institutionIds: [],
        hasInstitutionMembership: false,
        ltiIdentities: [],
        hasLtiIdentity: false,
      };
    }

    const ltiIdentities = await this.prisma.ltiIdentity.findMany({
      where: { userId },
      select: { institutionId: true, ltiUserId: true },
    });
    const institutionIds = Array.from(
      new Set(ltiIdentities.map((identity) => identity.institutionId)),
    );

    return {
      institutionIds,
      hasInstitutionMembership: institutionIds.length > 0,
      ltiIdentities,
      hasLtiIdentity: ltiIdentities.length > 0,
    };
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
      select: { id: true, level: true, currentExp: true },
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
    },
    avatar?: { id: number; level: number; currentExp: number } | null,
    membership?: {
      institutionIds?: number[];
      hasInstitutionMembership?: boolean;
      ltiIdentities?: { institutionId: number; ltiUserId: string }[];
      hasLtiIdentity?: boolean;
    },
    requireVerification?: boolean,
  ): AuthUser {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl ?? 'default-profile-pic.png',
      globalRole: user.globalRole,
      isVerified: user.isVerified ?? false,
      // Caller can flag that email verification is still pending for UX hints.
      requiresEmailVerification:
        requireVerification || !(user.isVerified ?? false),
      avatar: avatar ?? null,
      institutionIds: membership?.institutionIds ?? [],
      hasInstitutionMembership: membership?.hasInstitutionMembership ?? false,
      ltiIdentities: membership?.ltiIdentities ?? [],
      hasLtiIdentity: membership?.hasLtiIdentity ?? false,
    } as AuthUser;
  }
}
