import { BadRequestException } from '@nestjs/common';
import { ModuleUnitStatus } from '@prisma/client';
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

    expect(prisma.questionUnit.create).toHaveBeenCalledWith({
      data: { ...dto, isArchived: false },
    });
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
    prisma.moduleUnitQuestionGroup.create.mockResolvedValue(
      starterGroup as any,
    );
    prisma.questionUnit.create.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(prisma.moduleUnitQuestionGroup.findFirst).toHaveBeenCalledWith({
      where: { moduleUnitId: 5, isArchived: false },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.moduleUnitQuestionGroup.create).toHaveBeenCalledWith({
      data: {
        moduleUnitId: 5,
        name: 'Group 1',
        sortOrder: 1,
        isArchived: false,
      },
    });
    expect(prisma.questionUnit.create).toHaveBeenCalledWith({
      data: { ...dto, questionGroupId: starterGroup.id, isArchived: false },
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

    expect(prisma.moduleUnitQuestionGroup.create).not.toHaveBeenCalled();
    expect(prisma.questionUnit.create).toHaveBeenCalledWith({
      data: { ...dto, questionGroupId: 42, isArchived: false },
    });
  });

  it('create throws when questionGroupId is missing and moduleUnitId is absent', async () => {
    const dto = { title: 'Unit title' };

    await expect(service.create(dto as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.questionUnit.create).not.toHaveBeenCalled();
  });

  it('archives a question instead of deleting when unit is live', async () => {
    prisma.questionUnit.findUnique.mockResolvedValue({
      id: 9,
      moduleUnitId: 4,
      title: 'Q1',
      isArchived: false,
      moduleUnit: { id: 4, moduleId: 2, status: ModuleUnitStatus.live },
    } as any);
    prisma.questionAttempt.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    prisma.questionContent.updateMany.mockResolvedValue({ count: 1 } as any);
    prisma.questionUnit.update.mockResolvedValue({
      id: 9,
      moduleUnitId: 4,
      title: 'Q1',
      isArchived: true,
    } as any);

    await service.removeScoped(2, 4, 9);

    expect(prisma.questionContent.updateMany).toHaveBeenCalledWith({
      where: { questionUnitId: 9 },
      data: { isArchived: true },
    });
    expect(prisma.questionUnit.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { isArchived: true },
    });
    expect(prisma.questionUnit.delete).not.toHaveBeenCalled();
  });

  it('hard deletes a question when unit is draft and has no attempts', async () => {
    prisma.questionUnit.findUnique.mockResolvedValue({
      id: 9,
      moduleUnitId: 4,
      title: 'Q1',
      isArchived: false,
      moduleUnit: { id: 4, moduleId: 2, status: ModuleUnitStatus.draft },
    } as any);
    prisma.questionAttempt.count.mockResolvedValue(0);
    prisma.questionUnit.delete.mockResolvedValue({ id: 9 } as any);

    await service.removeScoped(2, 4, 9);

    expect(prisma.questionUnit.delete).toHaveBeenCalledWith({
      where: { id: 9 },
    });
    expect(prisma.questionContent.updateMany).not.toHaveBeenCalled();
  });

  it('archives a variant by archiving content when attempts already exist', async () => {
    prisma.questionVariant.findUnique.mockResolvedValue({
      id: 14,
      questionUnitId: 9,
      contentId: 21,
      questionUnit: {
        id: 9,
        moduleUnitId: 4,
        isArchived: false,
        moduleUnit: { id: 4, moduleId: 2, status: ModuleUnitStatus.draft },
      },
    } as any);
    prisma.questionAttempt.count.mockResolvedValue(2);
    prisma.questionContent.update.mockResolvedValue({
      id: 21,
      isArchived: true,
    } as any);

    await service.removeVariantScoped(2, 4, 9, 14);

    expect(prisma.questionContent.update).toHaveBeenCalledWith({
      where: { id: 21 },
      data: { isArchived: true },
    });
    expect(prisma.questionVariant.delete).not.toHaveBeenCalled();
  });
});
