import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaMock } from '../testing/test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionAttemptService } from './question-attempt.service';

describe('QuestionAttemptService', () => {
  let prisma: jest.Mocked<PrismaService>;
  let service: QuestionAttemptService;
  const modelKey = 'questionAttempt';
  const id = 10;
  const baseDto = {
    userId: 1,
    questionVariantId: 2,
    isCorrect: true,
    score: 0.8,
    attemptedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    prisma = createPrismaMock(modelKey);
    const moduleRef = await Test.createTestingModule({
      providers: [
        QuestionAttemptService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(QuestionAttemptService);
  });

  afterEach(() => jest.resetAllMocks());

  it('creates an attempt converting attemptedAt to Date', async () => {
    const created = { id, ...baseDto };
    (prisma as any)[modelKey].create.mockResolvedValue(created);

    const result = await service.create(baseDto);

    expect((prisma as any)[modelKey].create).toHaveBeenCalledWith({
      data: { ...baseDto, attemptedAt: new Date(baseDto.attemptedAt) },
    });
    expect(result).toEqual(created);
  });

  it('findOne returns the record when it exists', async () => {
    const existing = { id, ...baseDto };
    (prisma as any)[modelKey].findUnique.mockResolvedValue(existing);

    const result = await service.findOne(id);

    expect((prisma as any)[modelKey].findUnique).toHaveBeenCalledWith({ where: { id } });
    expect(result).toEqual(existing);
  });

  it('findOne throws NotFoundException when missing', async () => {
    (prisma as any)[modelKey].findUnique.mockResolvedValue(null);

    await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
  });

  it('update converts attemptedAt when provided', async () => {
    const updateDto = { score: 0.9, attemptedAt: '2024-02-01T00:00:00.000Z' };
    const updated = { id, ...baseDto, ...updateDto };
    (prisma as any)[modelKey].findUnique.mockResolvedValue({ id, ...baseDto });
    (prisma as any)[modelKey].update.mockResolvedValue(updated);

    const result = await service.update(id, updateDto);

    expect((prisma as any)[modelKey].update).toHaveBeenCalledWith({
      where: { id },
      data: { ...updateDto, attemptedAt: new Date(updateDto.attemptedAt) },
    });
    expect(result).toEqual(updated);
  });

  it('update omits attemptedAt when not provided', async () => {
    const updateDto = { score: 0.95 };
    (prisma as any)[modelKey].findUnique.mockResolvedValue({ id, ...baseDto });
    (prisma as any)[modelKey].update.mockResolvedValue({ id, ...baseDto, ...updateDto });

    await service.update(id, updateDto);

    expect((prisma as any)[modelKey].update).toHaveBeenCalledWith({
      where: { id },
      data: { ...updateDto, attemptedAt: undefined },
    });
  });

  it('remove throws when missing', async () => {
    (prisma as any)[modelKey].findUnique.mockResolvedValue(null);

    await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    expect((prisma as any)[modelKey].delete).not.toHaveBeenCalled();
  });
});
