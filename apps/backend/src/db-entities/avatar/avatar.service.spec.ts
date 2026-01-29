import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarService } from './avatar.service';

describe('AvatarService', () => {
  let prisma: PrismaMock;
  let moduleRef: TestingModule;
  let service: AvatarService;

  const userId = 1;
  const createDto = { userId, level: 2, currentExp: 100 };
  const now = new Date();

  beforeEach(async () => {
    prisma = createPrismaMock();

    moduleRef = await Test.createTestingModule({
      providers: [AvatarService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AvatarService);
  });

  afterEach(() => jest.resetAllMocks());

  it('create allows students without existing avatars', async () => {
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'student' } as any);
    prisma.avatar.findUnique.mockResolvedValue(null);
    prisma.avatar.create.mockResolvedValue({
      id: 1,
      ...createDto,
      createdAt: now,
    });

    const result = await service.create(createDto);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: { globalRole: true },
    });
    expect(prisma.avatar.findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(prisma.avatar.create).toHaveBeenCalledWith({ data: createDto });
    expect(result).toEqual({ id: 1, ...createDto, createdAt: now });
  });

  it('create rejects non-students', async () => {
    prisma.user.findUnique.mockResolvedValue({
      globalRole: 'instructor',
    } as any);

    await expect(service.create(createDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('create rejects when user is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
  });

  it('create rejects when avatar already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'student' } as any);
    prisma.avatar.findUnique.mockResolvedValue({ id: 2, userId } as any);

    await expect(service.create(createDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('findAll delegates to Prisma model', async () => {
    const rows = [
      { id: 1, ...createDto, createdAt: now },
      { id: 2, ...createDto, createdAt: now },
    ];
    prisma.avatar.findMany.mockResolvedValue(rows);

    const result = await service.findAll();

    expect(prisma.avatar.findMany).toHaveBeenCalledWith();
    expect(result).toEqual(rows);
  });

  it('findOne returns the record when found', async () => {
    prisma.avatar.findUnique.mockResolvedValue({
      id: 1,
      ...createDto,
      createdAt: now,
    });

    const result = await service.findOne(1);

    expect(prisma.avatar.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual({ id: 1, ...createDto, createdAt: now });
  });

  it('findOne throws NotFoundException when missing', async () => {
    prisma.avatar.findUnique.mockResolvedValue(null);

    await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
  });

  it('update checks existence then updates with DTO', async () => {
    const updateDto = { level: 3 };
    prisma.avatar.findUnique.mockResolvedValue({
      id: 1,
      ...createDto,
      createdAt: now,
    });
    prisma.avatar.update.mockResolvedValue({
      id: 1,
      ...createDto,
      ...updateDto,
      createdAt: now,
    });

    const result = await service.update(1, updateDto);

    expect(prisma.avatar.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma.avatar.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: updateDto,
    });
    expect(result).toEqual({
      id: 1,
      ...createDto,
      ...updateDto,
      createdAt: now,
    });
  });

  it('update rethrows NotFoundException when missing', async () => {
    prisma.avatar.findUnique.mockResolvedValue(null);

    await expect(service.update(1, { level: 3 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove checks existence then deletes', async () => {
    prisma.avatar.findUnique.mockResolvedValue({
      id: 1,
      ...createDto,
      createdAt: now,
    });
    prisma.avatar.delete.mockResolvedValue({
      id: 1,
      ...createDto,
      createdAt: now,
    });

    const result = await service.remove(1);

    expect(prisma.avatar.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma.avatar.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual({ id: 1, ...createDto, createdAt: now });
  });

  it('remove rethrows NotFoundException when missing', async () => {
    prisma.avatar.findUnique.mockResolvedValue(null);

    await expect(service.remove(1)).rejects.toThrow(NotFoundException);
  });
});
