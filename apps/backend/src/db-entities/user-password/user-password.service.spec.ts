import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { UserPasswordService } from './user-password.service';

describe('UserPasswordService', () => {
  let prisma: PrismaMock;
  let moduleRef: TestingModule;
  let service: UserPasswordService;

  const userId = 42;
  const createDto = { userId, passwordHash: 'hash' };
  const updateDto = { passwordHash: 'updated' };
  const existing = { userId, passwordHash: 'hash', updatedAt: new Date() };

  beforeEach(async () => {
    prisma = createPrismaMock('userPassword');
    moduleRef = await Test.createTestingModule({
      providers: [
        UserPasswordService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(UserPasswordService);
  });

  afterEach(() => jest.resetAllMocks());

  it('create forwards DTO to Prisma model', async () => {
    prisma.userPassword.create.mockResolvedValue(existing);

    const result = await service.create(createDto);

    expect(prisma.userPassword.create).toHaveBeenCalledWith({
      data: createDto,
    });
    expect(result).toEqual(existing);
  });

  it('findAll delegates to Prisma model', async () => {
    const rows = [
      { userId: 1, passwordHash: 'hash-1', updatedAt: new Date() },
      { userId: 2, passwordHash: 'hash-2', updatedAt: new Date() },
    ];
    prisma.userPassword.findMany.mockResolvedValue(rows);

    const result = await service.findAll();

    expect(prisma.userPassword.findMany).toHaveBeenCalledWith();
    expect(result).toEqual(rows);
  });

  it('findOne returns the record when found', async () => {
    prisma.userPassword.findUnique.mockResolvedValue(existing);

    const result = await service.findOne(userId);

    expect(prisma.userPassword.findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(result).toEqual(existing);
  });

  it('findOne throws NotFoundException when record is missing', async () => {
    prisma.userPassword.findUnique.mockResolvedValue(null);

    await expect(service.findOne(userId)).rejects.toThrow(NotFoundException);
    expect(prisma.userPassword.findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
  });

  it('update checks existence then updates with DTO', async () => {
    const updated = { userId, ...updateDto, updatedAt: new Date() };
    prisma.userPassword.findUnique.mockResolvedValue(existing);
    prisma.userPassword.update.mockResolvedValue(updated);

    const result = await service.update(userId, updateDto);

    expect(prisma.userPassword.findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(prisma.userPassword.update).toHaveBeenCalledWith({
      where: { userId },
      data: updateDto,
    });
    expect(result).toEqual(updated);
  });

  it('update rethrows NotFoundException when missing', async () => {
    prisma.userPassword.findUnique.mockResolvedValue(null);

    await expect(service.update(userId, updateDto)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.userPassword.update).not.toHaveBeenCalled();
  });

  it('remove checks existence then deletes', async () => {
    const removed = { userId, passwordHash: 'hash', updatedAt: new Date() };
    prisma.userPassword.findUnique.mockResolvedValue(existing);
    prisma.userPassword.delete.mockResolvedValue(removed);

    const result = await service.remove(userId);

    expect(prisma.userPassword.findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(prisma.userPassword.delete).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(result).toEqual(removed);
  });

  it('remove rethrows NotFoundException when missing', async () => {
    prisma.userPassword.findUnique.mockResolvedValue(null);

    await expect(service.remove(userId)).rejects.toThrow(NotFoundException);
    expect(prisma.userPassword.delete).not.toHaveBeenCalled();
  });
});
