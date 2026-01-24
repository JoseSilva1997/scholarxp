import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaMock, PrismaMock } from '../testing/test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionAttemptService } from './question-attempt.service';

describe('QuestionAttemptService', () => {
  let prisma: PrismaMock;
  let service: QuestionAttemptService;
  const id = 10;
  const baseDto = {
    moduleUnitId: 1,
    studentId: 2,
    questionId: 3,
    contentId: 4,
    practiceMode: 'timed',
    isCorrect: true,
    timeTakenMs: 1200,
    hintsUsed: 0,
    studentAnswer: { choice: 'A' },
    attemptedAt: '2024-01-01T00:00:00.000Z',
  };
  const attemptedAtDate = new Date(baseDto.attemptedAt);

  beforeEach(async () => {
    prisma = createPrismaMock();
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
    const created = { id, ...baseDto, attemptedAt: attemptedAtDate };
    prisma.questionAttempt.create.mockResolvedValue(created);

    const result = await service.create(baseDto);

    expect(prisma.questionAttempt.create).toHaveBeenCalledWith({
      data: { ...baseDto, attemptedAt: attemptedAtDate },
    });
    expect(result).toEqual(created);
  });

  it('findOne returns the record when it exists', async () => {
    const existing = { id, ...baseDto, attemptedAt: attemptedAtDate };
    prisma.questionAttempt.findUnique.mockResolvedValue(existing);

    const result = await service.findOne(id);

    expect(prisma.questionAttempt.findUnique).toHaveBeenCalledWith({
      where: { id },
    });
    expect(result).toEqual(existing);
  });

  it('findOne throws NotFoundException when missing', async () => {
    prisma.questionAttempt.findUnique.mockResolvedValue(null);

    await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
  });

  it('update converts attemptedAt when provided', async () => {
    const updateDto = {
      timeTakenMs: 900,
      attemptedAt: '2024-02-01T00:00:00.000Z',
    };
    const updated = {
      id,
      ...baseDto,
      ...updateDto,
      attemptedAt: new Date(updateDto.attemptedAt),
    };
    prisma.questionAttempt.findUnique.mockResolvedValue({
      id,
      ...baseDto,
      attemptedAt: attemptedAtDate,
    });
    prisma.questionAttempt.update.mockResolvedValue(updated);

    const result = await service.update(id, updateDto);

    expect(prisma.questionAttempt.update).toHaveBeenCalledWith({
      where: { id },
      data: { ...updateDto, attemptedAt: new Date(updateDto.attemptedAt) },
    });
    expect(result).toEqual(updated);
  });

  it('update omits attemptedAt when not provided', async () => {
    const updateDto = { timeTakenMs: 1100 };
    prisma.questionAttempt.findUnique.mockResolvedValue({
      id,
      ...baseDto,
      attemptedAt: attemptedAtDate,
    });
    prisma.questionAttempt.update.mockResolvedValue({
      id,
      ...baseDto,
      ...updateDto,
      attemptedAt: attemptedAtDate,
    });

    await service.update(id, updateDto);

    expect(prisma.questionAttempt.update).toHaveBeenCalledWith({
      where: { id },
      data: { ...updateDto, attemptedAt: undefined },
    });
  });

  it('remove throws when missing', async () => {
    prisma.questionAttempt.findUnique.mockResolvedValue(null);

    await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    expect(prisma.questionAttempt.delete).not.toHaveBeenCalled();
  });
});
