import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaMock, PrismaMock } from '../testing/test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeSessionService } from './practice-session.service';

describe('PracticeSessionService', () => {
  let prisma: PrismaMock;
  let service: PracticeSessionService;
  const modelKey = 'practiceSession';
  const id = 7;
  const baseDto = {
    moduleId: 1,
    userId: 2,
    startTime: '2024-01-01T10:00:00.000Z',
    endTime: '2024-01-01T11:00:00.000Z',
  };
  const startTimeDate = new Date(baseDto.startTime);
  const endTimeDate = new Date(baseDto.endTime);

  beforeEach(async () => {
    prisma = createPrismaMock(modelKey);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PracticeSessionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(PracticeSessionService);
  });

  afterEach(() => jest.resetAllMocks());

  it('create converts start/end time strings to Date', async () => {
    const created = { id, ...baseDto, startTime: startTimeDate, endTime: endTimeDate };
    (prisma as any)[modelKey].create.mockResolvedValue(created);

    const result = await service.create(baseDto);

    expect((prisma as any)[modelKey].create).toHaveBeenCalledWith({
      data: {
        moduleId: baseDto.moduleId,
        userId: baseDto.userId,
        startTime: startTimeDate,
        endTime: endTimeDate,
      },
    });
    expect(result).toEqual(created);
  });

  it('create allows null endTime', async () => {
    const dto = { ...baseDto, endTime: null };
    (prisma as any)[modelKey].create.mockResolvedValue({ id, ...dto, startTime: startTimeDate });

    await service.create(dto);

    expect((prisma as any)[modelKey].create).toHaveBeenCalledWith({
      data: {
        moduleId: dto.moduleId,
        userId: dto.userId,
        startTime: new Date(dto.startTime),
        endTime: null,
      },
    });
  });

  it('findOne returns the record when it exists', async () => {
    const existing = { id, ...baseDto, startTime: startTimeDate, endTime: endTimeDate };
    (prisma as any)[modelKey].findUnique.mockResolvedValue(existing);

    const result = await service.findOne(id);

    expect((prisma as any)[modelKey].findUnique).toHaveBeenCalledWith({ where: { id } });
    expect(result).toEqual(existing);
  });

  it('update converts provided timestamps and preserves undefined fields', async () => {
    const updateDto = { startTime: '2024-02-01T10:00:00.000Z', endTime: null };
    (prisma as any)[modelKey].findUnique.mockResolvedValue({
      id,
      ...baseDto,
      startTime: startTimeDate,
      endTime: endTimeDate,
    });
    (prisma as any)[modelKey].update.mockResolvedValue({
      id,
      ...baseDto,
      ...updateDto,
      startTime: new Date(updateDto.startTime),
      endTime: null,
    });

    await service.update(id, updateDto);

    expect((prisma as any)[modelKey].update).toHaveBeenCalledWith({
      where: { id },
      data: {
        startTime: new Date(updateDto.startTime),
        endTime: null,
      },
    });
  });

  it('update leaves start/end undefined when omitted', async () => {
    const updateDto = { moduleId: 5, userId: 6 } as any;
    (prisma as any)[modelKey].findUnique.mockResolvedValue({
      id,
      ...baseDto,
      startTime: startTimeDate,
      endTime: endTimeDate,
    });
    (prisma as any)[modelKey].update.mockResolvedValue({
      id,
      ...baseDto,
      ...updateDto,
      startTime: startTimeDate,
      endTime: endTimeDate,
    });

    await service.update(id, updateDto);

    expect((prisma as any)[modelKey].update).toHaveBeenCalledWith({
      where: { id },
      data: {
        moduleId: 5,
        userId: 6,
        startTime: undefined,
        endTime: undefined,
      },
    });
  });

  it('remove throws when record is missing', async () => {
    (prisma as any)[modelKey].findUnique.mockResolvedValue(null);

    await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    expect((prisma as any)[modelKey].delete).not.toHaveBeenCalled();
  });
});
