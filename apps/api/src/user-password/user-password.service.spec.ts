import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createPrismaMock } from '../testing/test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { UserPasswordService } from './user-password.service';

describe('UserPasswordService', () => {
  let prisma: jest.Mocked<PrismaService>;
  let moduleRef: TestingModule;
  let service: UserPasswordService;
  let userPassword: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const userId = 42;
  const createDto = { userId, passwordHash: 'hash' };
  const updateDto = { passwordHash: 'updated' };
  const existing = { userId, passwordHash: 'hash' };

  beforeEach(async () => {
    prisma = createPrismaMock('userPassword');
    userPassword = (prisma as any).userPassword;
    moduleRef = await Test.createTestingModule({
      providers: [UserPasswordService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UserPasswordService);
  });

  afterEach(() => jest.resetAllMocks());

  it('create forwards DTO to Prisma model', async () => {
    userPassword.create.mockResolvedValue(existing);

    const result = await service.create(createDto);

    expect(userPassword.create).toHaveBeenCalledWith({ data: createDto });
    expect(result).toEqual(existing);
  });

  it('findAll delegates to Prisma model', async () => {
    const rows = [{ userId: 1 }, { userId: 2 }];
    userPassword.findMany.mockResolvedValue(rows);

    const result = await service.findAll();

    expect(userPassword.findMany).toHaveBeenCalledWith();
    expect(result).toEqual(rows);
  });

  it('findOne returns the record when found', async () => {
    userPassword.findUnique.mockResolvedValue(existing);

    const result = await service.findOne(userId);

    expect(userPassword.findUnique).toHaveBeenCalledWith({ where: { userId } });
    expect(result).toEqual(existing);
  });

  it('findOne throws NotFoundException when record is missing', async () => {
    userPassword.findUnique.mockResolvedValue(null);

    await expect(service.findOne(userId)).rejects.toThrow(NotFoundException);
    expect(userPassword.findUnique).toHaveBeenCalledWith({ where: { userId } });
  });

  it('update checks existence then updates with DTO', async () => {
    const updated = { userId, ...updateDto };
    userPassword.findUnique.mockResolvedValue(existing);
    userPassword.update.mockResolvedValue(updated);

    const result = await service.update(userId, updateDto);

    expect(userPassword.findUnique).toHaveBeenCalledWith({ where: { userId } });
    expect(userPassword.update).toHaveBeenCalledWith({ where: { userId }, data: updateDto });
    expect(result).toEqual(updated);
  });

  it('update rethrows NotFoundException when missing', async () => {
    userPassword.findUnique.mockResolvedValue(null);

    await expect(service.update(userId, updateDto)).rejects.toThrow(NotFoundException);
    expect(userPassword.update).not.toHaveBeenCalled();
  });

  it('remove checks existence then deletes', async () => {
    const removed = { userId };
    userPassword.findUnique.mockResolvedValue(existing);
    userPassword.delete.mockResolvedValue(removed);

    const result = await service.remove(userId);

    expect(userPassword.findUnique).toHaveBeenCalledWith({ where: { userId } });
    expect(userPassword.delete).toHaveBeenCalledWith({ where: { userId } });
    expect(result).toEqual(removed);
  });

  it('remove rethrows NotFoundException when missing', async () => {
    userPassword.findUnique.mockResolvedValue(null);

    await expect(service.remove(userId)).rejects.toThrow(NotFoundException);
    expect(userPassword.delete).not.toHaveBeenCalled();
  });
});
