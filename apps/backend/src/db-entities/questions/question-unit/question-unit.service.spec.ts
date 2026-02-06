import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaMock, PrismaMock } from '../../../test/test-helpers';
import { PrismaService } from '../../../prisma/prisma.service';
import { QuestionUnitService } from './question-unit.service';

describe('QuestionUnitService', () => {
  let prisma: PrismaMock;
  let service: QuestionUnitService;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        QuestionUnitService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(QuestionUnitService);
  });

  afterEach(() => jest.resetAllMocks());

  it('create uses provided questionGroupId when present', async () => {
    const dto = { moduleUnitId: 1, questionGroupId: 2, title: 'Unit title' };
    const created = {
      id: 1,
      ...dto,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.questionUnit.create.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(prisma.questionUnit.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual(created);
  });

  it('create assigns Group 1 when questionGroupId is missing and no groups exist', async () => {
    const dto = { moduleUnitId: 5, title: 'Unit title' };
    const starterGroup = {
      id: 10,
      moduleUnitId: 5,
      name: 'Group 1',
      sortOrder: 1,
    };
    const created = {
      id: 1,
      ...dto,
      questionGroupId: starterGroup.id,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.moduleUnitQuestionGroup.findFirst.mockResolvedValue(null as any);
    prisma.moduleUnitQuestionGroup.upsert.mockResolvedValue(
      starterGroup as any,
    );
    prisma.questionUnit.create.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(prisma.moduleUnitQuestionGroup.findFirst).toHaveBeenCalledWith({
      where: { moduleUnitId: 5 },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.moduleUnitQuestionGroup.upsert).toHaveBeenCalledWith({
      where: {
        moduleUnitId_name: {
          moduleUnitId: 5,
          name: 'Group 1',
        },
      },
      update: {},
      create: {
        moduleUnitId: 5,
        name: 'Group 1',
        sortOrder: 1,
      },
    });
    expect(prisma.questionUnit.create).toHaveBeenCalledWith({
      data: { ...dto, questionGroupId: starterGroup.id },
    });
    expect(result).toEqual(created);
  });

  it('create reuses first existing group when questionGroupId is missing', async () => {
    const dto = { moduleUnitId: 5, title: 'Unit title' };
    prisma.moduleUnitQuestionGroup.findFirst.mockResolvedValue({
      id: 42,
    } as any);
    prisma.questionUnit.create.mockResolvedValue({
      id: 1,
      ...dto,
      questionGroupId: 42,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await service.create(dto);

    expect(prisma.moduleUnitQuestionGroup.upsert).not.toHaveBeenCalled();
    expect(prisma.questionUnit.create).toHaveBeenCalledWith({
      data: { ...dto, questionGroupId: 42 },
    });
  });

  it('create throws when questionGroupId is missing and moduleUnitId is absent', async () => {
    const dto = { title: 'Unit title' };

    await expect(service.create(dto as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.questionUnit.create).not.toHaveBeenCalled();
  });
});
