import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole, Prisma } from '@prisma/client';
import {
  DEFAULT_PROFILE_PICTURE_VALUE,
  PROFILE_PICTURE_ALLOWED_MIME_TYPES,
  PROFILE_PICTURE_MAX_BYTES,
  type ProfilePictureMimeType,
} from '@scholarxp/api-contracts';
import { randomUUID } from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../file-storage/storage.service';
import { ANON_USER_ID } from './anon-user.constant';

// Service for user account management including profile updates, role changes, and self-service deletion.
// Profile picture uploads are validated against both declared MIME type and magic bytes to prevent
// content-type spoofing attacks.

// Magic-byte signatures for the three image formats we accept; checked alongside the declared MIME type
// so a client cannot smuggle a non-image by setting the Content-Type header.
const IMAGE_MAGIC_BYTES: Record<
  ProfilePictureMimeType,
  (b: Buffer) => boolean
> = {
  'image/png': (b) =>
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  'image/jpeg': (b) =>
    b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) =>
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP',
};

const MIME_TO_EXT: Record<ProfilePictureMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Creation uses DTO-level transformations (trim, normalize) and keeps validation rules centralized.
  async create(createUserDto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: {
          ...createUserDto,
          email: createUserDto.email ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: number) {
    return this.getUserOrThrow(id);
  }
  // Generic update method for any user fields
  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.getUserOrThrow(id);
    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  // Updates the user's global role. When transitioning to student, creates an avatar record
  // within the same transaction if one does not already exist.
  async updateRole(id: number, role: GlobalRole) {
    const existingUser = await this.getUserOrThrow(id);
    const shouldCreateAvatar =
      role === GlobalRole.student &&
      existingUser.globalRole !== GlobalRole.student;

    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: { globalRole: role },
      });

      if (shouldCreateAvatar) {
        const existingAvatar = await tx.avatar.findFirst({
          where: { userId: id },
          select: { id: true },
        });
        // Ensure every newly declared student starts with an avatar for XP tracking.
        if (!existingAvatar) {
          await tx.avatar.create({
            data: {
              userId: id,
              totalExp: 0,
            },
          });
        }
      }
      return updatedUser;
    });
  }

  async updateName(id: number, firstName: string, lastName: string) {
    await this.getUserOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { firstName, lastName },
    });
  }

  async updateTimezone(id: number, timezone: string) {
    await this.getUserOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { timezone },
    });
  }

  // Uploads a new profile picture to cloud storage, updates the user record with the public URL,
  // and deletes the prior upload if it was owned by this application (not an OAuth provider URL).
  async updateProfilePicture(
    id: number,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (file.size > PROFILE_PICTURE_MAX_BYTES) {
      throw new BadRequestException('Image exceeds maximum size');
    }
    const mime = file.mimetype as ProfilePictureMimeType;
    if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.includes(mime)) {
      throw new BadRequestException('Unsupported image type');
    }
    // Magic-byte sniff catches spoofed Content-Type values; declared MIME alone is not trustworthy from the client.
    if (!IMAGE_MAGIC_BYTES[mime](file.buffer)) {
      throw new BadRequestException(
        'File contents do not match declared image type',
      );
    }

    const existing = await this.getUserOrThrow(id);
    const objectPath = `profile-pictures/${id}/${randomUUID()}.${MIME_TO_EXT[mime]}`;
    const { publicUrl } = await this.storage.upload(
      objectPath,
      file.buffer,
      mime,
    );

    const updated = await this.prisma.user.update({
      where: { id },
      data: { profilePictureUrl: publicUrl },
    });

    // Only delete prior blobs we own; external sources (Google OAuth avatar URLs) must never be touched.
    if (this.storage.isOwnedUrl(existing.profilePictureUrl)) {
      const priorPath = this.storage.pathFromUrl(existing.profilePictureUrl);
      if (priorPath && priorPath !== objectPath) {
        await this.storage.delete(priorPath);
      }
    }

    return updated;
  }

  async removeProfilePicture(id: number) {
    const existing = await this.getUserOrThrow(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { profilePictureUrl: DEFAULT_PROFILE_PICTURE_VALUE },
    });
    if (this.storage.isOwnedUrl(existing.profilePictureUrl)) {
      const priorPath = this.storage.pathFromUrl(existing.profilePictureUrl);
      if (priorPath) {
        await this.storage.delete(priorPath);
      }
    }
    return updated;
  }

  async remove(id: number) {
    await this.getUserOrThrow(id);
    return this.prisma.user.delete({ where: { id } });
  }

  // Self-serve hard delete. Reassigns authored modules/invites to the Anon sentinel so student access is preserved,
  // then deletes the user; cascading FKs (avatar, user_modules, daily_quests, exp_ledger, auth_identity, etc.) clean the rest.
  async removeSelf(userId: number, confirmEmail: string) {
    if (userId === ANON_USER_ID) {
      throw new ForbiddenException('This account cannot be deleted');
    }
    const user = await this.getUserOrThrow(userId);
    const submitted = confirmEmail.trim().toLowerCase();
    const stored = user.email?.trim().toLowerCase() ?? '';
    if (!stored || submitted !== stored) {
      throw new BadRequestException(
        'Email confirmation does not match account email',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.module.updateMany({
        where: { createdByUserId: userId },
        data: { createdByUserId: ANON_USER_ID },
      });
      await tx.moduleInvite.updateMany({
        where: { createdByUserId: userId },
        data: { createdByUserId: ANON_USER_ID },
      });
      await tx.user.delete({ where: { id: userId } });
    });
  }

  private async getUserOrThrow(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
