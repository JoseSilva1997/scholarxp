import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GlobalRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../file-storage/storage.service';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;
  let storage: jest.Mocked<
    Pick<
      StorageService,
      'upload' | 'delete' | 'isOwnedUrl' | 'pathFromUrl' | 'publicUrl'
    >
  >;

  const now = new Date('2026-01-01T00:00:00Z');
  const baseUser = {
    id: 42,
    firstName: 'Test',
    lastName: 'User',
    email: 'user@example.com',
    profilePictureUrl: 'default-profile-pic.png',
    globalRole: GlobalRole.pending,
    isVerified: false,
    createdAt: now,
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    storage = {
      upload: jest.fn(),
      delete: jest.fn(),
      isOwnedUrl: jest.fn(),
      pathFromUrl: jest.fn(),
      publicUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => jest.resetAllMocks());

  describe('create and list', () => {
    it('creates users with nullable emails and lists all users', async () => {
      prisma.user.create.mockResolvedValue({ ...baseUser, email: null });
      prisma.user.findMany.mockResolvedValue([baseUser] as never);

      await expect(
        service.create({
          firstName: 'Test',
          lastName: 'User',
          email: undefined,
        } as any),
      ).resolves.toMatchObject({ email: null });
      await expect(service.findAll()).resolves.toEqual([baseUser]);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          firstName: 'Test',
          lastName: 'User',
          email: null,
        },
      });
    });

    it('maps duplicate email creates to ConflictException and hides unknown persistence errors', async () => {
      prisma.user.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Duplicate', {
          code: 'P2002',
          clientVersion: '5.x',
        }),
      );
      await expect(
        service.create({
          firstName: 'Test',
          lastName: 'User',
          email: 'user@example.com',
        } as any),
      ).rejects.toThrow('Email already exists');

      prisma.user.create.mockRejectedValueOnce(new Error('database down'));
      await expect(
        service.create({
          firstName: 'Test',
          lastName: 'User',
          email: 'user@example.com',
        } as any),
      ).rejects.toThrow('Internal Server Error');
    });
  });

  describe('findOne', () => {
    it('returns the user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.findOne(baseUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: baseUser.id },
      });
      expect(result).toEqual(baseUser);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(baseUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(baseUser.id, { firstName: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates fields without triggering avatar logic', async () => {
      const updateDto = { firstName: 'Updated' };
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({ ...baseUser, ...updateDto });

      const result = await service.update(baseUser.id, updateDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: updateDto,
      });
      expect(prisma.avatar.findFirst).not.toHaveBeenCalled();
      expect(prisma.avatar.create).not.toHaveBeenCalled();
      expect(result).toEqual({ ...baseUser, ...updateDto });
    });

    it('passes nullable email as null to keep Prisma consistent', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({ ...baseUser, email: null });

      const result = await service.update(baseUser.id, { email: undefined });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { email: undefined },
      });
      expect(result.email).toBeNull();
    });

    it('maps duplicate email updates to ConflictException and hides unknown persistence errors', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Duplicate', {
          code: 'P2002',
          clientVersion: '5.x',
        }),
      );
      await expect(
        service.update(baseUser.id, { email: 'taken@example.com' }),
      ).rejects.toThrow('Email already exists');

      prisma.user.update.mockRejectedValueOnce(new Error('database down'));
      await expect(
        service.update(baseUser.id, { firstName: 'Updated' }),
      ).rejects.toThrow('Internal Server Error');
    });
  });

  describe('updateRole', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole(baseUser.id, GlobalRole.student),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates an avatar when switching to student and none exists', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        globalRole: GlobalRole.student,
      });
      prisma.avatar.findFirst.mockResolvedValue(null);

      const result = await service.updateRole(baseUser.id, GlobalRole.student);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { globalRole: GlobalRole.student },
      });
      expect(prisma.avatar.findFirst).toHaveBeenCalledWith({
        where: { userId: baseUser.id },
        select: { id: true },
      });
      expect(prisma.avatar.create).toHaveBeenCalledWith({
        data: { userId: baseUser.id, totalExp: 0 },
      });
      expect(result).toEqual({ ...baseUser, globalRole: GlobalRole.student });
    });

    it('does not duplicate avatar when one already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        globalRole: GlobalRole.student,
      });
      prisma.avatar.findFirst.mockResolvedValue({
        id: 10,
        userId: baseUser.id,
        totalExp: 0,
        createdAt: now,
      });

      await service.updateRole(baseUser.id, GlobalRole.student);

      expect(prisma.avatar.create).not.toHaveBeenCalled();
    });

    it('leaves avatar untouched when switching to teacher', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        globalRole: GlobalRole.teacher,
      });

      await service.updateRole(baseUser.id, GlobalRole.teacher);

      expect(prisma.avatar.findFirst).not.toHaveBeenCalled();
      expect(prisma.avatar.create).not.toHaveBeenCalled();
    });
  });

  describe('updateName', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateName(baseUser.id, 'New', 'Name'),
      ).rejects.toThrow(NotFoundException);
    });

    it('persists the new first and last name', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        firstName: 'New',
        lastName: 'Name',
      });

      const result = await service.updateName(baseUser.id, 'New', 'Name');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { firstName: 'New', lastName: 'Name' },
      });
      expect(result.firstName).toBe('New');
      expect(result.lastName).toBe('Name');
    });
  });

  describe('updateTimezone and remove', () => {
    it('updates timezone and deletes existing users', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        timezone: 'America/New_York',
      } as never);
      prisma.user.delete.mockResolvedValue(baseUser as never);

      await expect(
        service.updateTimezone(baseUser.id, 'America/New_York'),
      ).resolves.toMatchObject({ timezone: 'America/New_York' });
      await expect(service.remove(baseUser.id)).resolves.toEqual(baseUser);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { timezone: 'America/New_York' },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: baseUser.id },
      });
    });

    it('throws NotFoundException before timezone updates or removals for missing users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTimezone(baseUser.id, 'America/New_York'),
      ).rejects.toThrow(NotFoundException);
      await expect(service.remove(baseUser.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateProfilePicture', () => {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);

    function pngFile(
      overrides: Partial<{
        size: number;
        mimetype: string;
        buffer: Buffer;
      }> = {},
    ) {
      return {
        buffer: overrides.buffer ?? pngBuffer,
        mimetype: overrides.mimetype ?? 'image/png',
        size: overrides.size ?? pngBuffer.length,
      };
    }

    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const webpBuffer = Buffer.from('RIFF1234WEBPextra', 'ascii');

    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        service.updateProfilePicture(baseUser.id, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects files exceeding the size limit', async () => {
      await expect(
        service.updateProfilePicture(
          baseUser.id,
          pngFile({ size: 6 * 1024 * 1024 }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unsupported MIME types', async () => {
      await expect(
        service.updateProfilePicture(
          baseUser.id,
          pngFile({ mimetype: 'image/gif' }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects spoofed Content-Type when magic bytes do not match', async () => {
      await expect(
        service.updateProfilePicture(
          baseUser.id,
          pngFile({ buffer: Buffer.from('not-an-image') }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('uploads, persists the public URL, and deletes the prior owned blob', async () => {
      const owned =
        'https://storage.googleapis.com/bucket/profile-pictures/42/old.png';
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: owned,
      });
      storage.upload.mockResolvedValue({
        path: 'p',
        publicUrl: 'https://cdn/new.png',
      });
      storage.isOwnedUrl.mockReturnValue(true);
      storage.pathFromUrl.mockReturnValue('profile-pictures/42/old.png');
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'https://cdn/new.png',
      });

      const result = await service.updateProfilePicture(baseUser.id, pngFile());

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^profile-pictures\/42\/[0-9a-f-]+\.png$/),
        pngBuffer,
        'image/png',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { profilePictureUrl: 'https://cdn/new.png' },
      });
      expect(storage.delete).toHaveBeenCalledWith(
        'profile-pictures/42/old.png',
      );
      expect(result.profilePictureUrl).toBe('https://cdn/new.png');
    });

    it('does not delete external URLs (e.g. Google OAuth avatars)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'https://lh3.googleusercontent.com/a/google-avatar',
      });
      storage.upload.mockResolvedValue({
        path: 'p',
        publicUrl: 'https://cdn/new.png',
      });
      storage.isOwnedUrl.mockReturnValue(false);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'https://cdn/new.png',
      });

      await service.updateProfilePicture(baseUser.id, pngFile());

      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('accepts JPEG and WEBP signatures and skips delete when owned URL cannot be parsed', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'https://cdn/owned-but-unparseable',
      });
      storage.upload
        .mockResolvedValueOnce({
          path: 'p',
          publicUrl: 'https://cdn/new.jpg',
        })
        .mockResolvedValueOnce({
          path: 'p',
          publicUrl: 'https://cdn/new.webp',
        });
      storage.isOwnedUrl.mockReturnValue(true);
      storage.pathFromUrl.mockReturnValue(null);
      prisma.user.update
        .mockResolvedValueOnce({
          ...baseUser,
          profilePictureUrl: 'https://cdn/new.jpg',
        })
        .mockResolvedValueOnce({
          ...baseUser,
          profilePictureUrl: 'https://cdn/new.webp',
        });

      await service.updateProfilePicture(baseUser.id, {
        buffer: jpegBuffer,
        mimetype: 'image/jpeg',
        size: jpegBuffer.length,
      });
      await service.updateProfilePicture(baseUser.id, {
        buffer: webpBuffer,
        mimetype: 'image/webp',
        size: webpBuffer.length,
      });

      expect(storage.upload).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/^profile-pictures\/42\/[0-9a-f-]+\.jpg$/),
        jpegBuffer,
        'image/jpeg',
      );
      expect(storage.upload).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/^profile-pictures\/42\/[0-9a-f-]+\.webp$/),
        webpBuffer,
        'image/webp',
      );
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('removeProfilePicture', () => {
    it('resets to the default sentinel and deletes prior owned blob', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        profilePictureUrl:
          'https://storage.googleapis.com/bucket/profile-pictures/42/old.png',
      });
      storage.isOwnedUrl.mockReturnValue(true);
      storage.pathFromUrl.mockReturnValue('profile-pictures/42/old.png');
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'default-profile-pic.png',
      });

      const result = await service.removeProfilePicture(baseUser.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { profilePictureUrl: 'default-profile-pic.png' },
      });
      expect(storage.delete).toHaveBeenCalledWith(
        'profile-pictures/42/old.png',
      );
      expect(result.profilePictureUrl).toBe('default-profile-pic.png');
    });

    it('does not call storage.delete when the prior URL is external', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'https://lh3.googleusercontent.com/a/google-avatar',
      });
      storage.isOwnedUrl.mockReturnValue(false);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'default-profile-pic.png',
      });

      await service.removeProfilePicture(baseUser.id);

      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('skips deletion when an owned URL cannot be converted to a storage path', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'https://cdn/owned-but-unparseable',
      });
      storage.isOwnedUrl.mockReturnValue(true);
      storage.pathFromUrl.mockReturnValue(null);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        profilePictureUrl: 'default-profile-pic.png',
      });

      await service.removeProfilePicture(baseUser.id);

      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
