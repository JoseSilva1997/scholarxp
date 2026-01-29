import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthProvider, GlobalRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EmailVerificationTokenService } from '../db-entities/email-verification-token/email-verification-token.service';
import { MailerService } from '../mailer/mailer.service';
import { AuthUser } from '../types/auth-user.type';

type UserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  profilePictureUrl?: string | null;
  globalRole: GlobalRole;
  isVerified?: boolean;
};

// Google OAuth profile data returned from the strategy
type GoogleProfilePayload = {
  firstName: string;
  lastName: string;
  profilePictureUrl: string;
  email: string | null;
};

// Google identity binding with provider-specific ID
export type GoogleIdentity = GoogleProfilePayload & {
  providerUserId: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTokens: EmailVerificationTokenService,
    private readonly mailer: MailerService,
  ) {}

  async registerByEmail(dto: RegisterDto) {
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
        data: {
          userId: createdUser.id,
          passwordHash,
        },
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

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const password = await this.prisma.userPassword.findUnique({
      where: { userId: user.id },
    });
    if (!password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, password.passwordHash);
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

  async verifyEmail(token: string) {
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

  async loginWithGoogle(payload: GoogleIdentity & { picture?: string }) {
    const email = payload.email?.trim().toLowerCase() ?? null;
    const profilePictureUrl = payload.picture ?? 'default-profile-pic.png';

    // Check if this Google account is already linked; if so, just refresh the profile and return.
    const existingIdentity = await this.findGoogleIdentity(
      payload.providerUserId,
    );
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

    // We cannot create/link without an email from Google (rare but possible).
    if (!email) {
      throw new UnauthorizedException('Google account has no email');
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

  // Looks up a Google auth identity (with its user) so we can short-circuit on returning users.
  private findGoogleIdentity(providerUserId: string) {
    return this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.google,
          providerUserId,
        },
      },
      include: { user: true },
    }) as Promise<{ user: UserRecord } | null>;
  }

  // Refreshes stored profile fields from Google every login without clobbering with empty values.
  private async refreshUserFromGoogle(
    user: UserRecord,
    incoming: GoogleProfilePayload,
  ) {
    const updates = this.buildGoogleProfileUpdates(user, incoming);
    if (Object.keys(updates).length === 0) {
      return user;
    }
    return this.prisma.user.update({ where: { id: user.id }, data: updates });
  }

  // Matches by email when possible, otherwise creates a new user and records the Google identity.
  private async linkOrCreateUserForGoogle(
    existingUser: UserRecord | null,
    incoming: GoogleIdentity,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Keep existing users fresh; otherwise create a new one with Google defaults.
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

      // Ensure there is a Google auth identity linked to the user for next logins.
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

  // Determine which user fields should be refreshed from Google on every login while
  // avoiding overwriting existing data with empty values.
  private buildGoogleProfileUpdates(
    user: UserRecord,
    incoming: GoogleProfilePayload,
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

  // Retrieve user by ID and avatar if student
  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('Session invalid');
    }
    const avatar = await this.loadAvatarIfStudent(user);
    const membership = await this.loadInstitutionMembership(user.id);
    return this.toAuthUser(user, avatar, membership);
  }

  // Load institution/LTI membership only when the user has any LTI identity; avoids extra selects for non-institution users.
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

  // It is much easier to create a payload which contains Avatar info directly.
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
  ): AuthUser & { requiresEmailVerification?: boolean } {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl ?? 'default-profile-pic.png',
      globalRole: user.globalRole,
      isVerified: user.isVerified ?? false,
      requiresEmailVerification:
        requireVerification || !(user.isVerified ?? false),
      avatar: avatar ?? null,
      institutionIds: membership?.institutionIds ?? [],
      hasInstitutionMembership: membership?.hasInstitutionMembership ?? false,
      ltiIdentities: membership?.ltiIdentities ?? [],
      hasLtiIdentity: membership?.hasLtiIdentity ?? false,
    };
  }
}
