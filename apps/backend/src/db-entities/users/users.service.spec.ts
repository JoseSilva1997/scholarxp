import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => jest.resetAllMocks());

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
});
