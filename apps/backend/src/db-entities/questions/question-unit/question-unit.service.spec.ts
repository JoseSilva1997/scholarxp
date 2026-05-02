import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ModuleUnitStatus, Prisma } from '@prisma/client';
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

  it('supports legacy find, update, and remove methods', async () => {
    const question = {
      id: 3,
      moduleUnitId: 4,
      questionGroupId: 5,
      title: 'Q1',
      isArchived: false,
    };
    prisma.questionUnit.findMany.mockResolvedValue([question] as any);
    prisma.questionUnit.findUnique.mockResolvedValue(question as any);
    prisma.questionUnit.update.mockResolvedValue({
      ...question,
      title: 'Updated',
    } as any);
    prisma.questionUnit.delete.mockResolvedValue(question as any);

    await expect(service.findAll()).resolves.toEqual([question]);
    await expect(service.findOne(question.id)).resolves.toEqual(question);
    await expect(
      service.update(question.id, { title: 'Updated' }),
    ).resolves.toMatchObject({ title: 'Updated' });
    await expect(service.remove(question.id)).resolves.toEqual(question);

    expect(prisma.questionUnit.update).toHaveBeenCalledWith({
      where: { id: question.id },
      data: { title: 'Updated' },
    });
    expect(prisma.questionUnit.delete).toHaveBeenCalledWith({
      where: { id: question.id },
    });
  });

  it('rejects missing or archived legacy question records', async () => {
    prisma.questionUnit.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne(404)).rejects.toThrow(NotFoundException);

    prisma.questionUnit.findUnique.mockResolvedValueOnce({
      id: 3,
      isArchived: true,
    } as any);
    await expect(service.update(3, { title: 'Nope' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates a question and core content after validating unit, group, and question data', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 4,
      moduleId: 2,
    } as any);
    prisma.moduleUnitQuestionGroup.findFirst.mockResolvedValue({
      id: 8,
    } as any);
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    prisma.questionUnit.create.mockResolvedValue({
      id: 9,
      moduleUnitId: 4,
      questionGroupId: 8,
      title: 'Core title',
    } as any);
    prisma.questionContent.create.mockResolvedValue({
      id: 21,
      questionUnitId: 9,
      questionStem: 'Pick one',
      questionData: validMcqData(),
      type: 'mcq',
      hint: null,
      source: 'manual',
      isArchived: false,
      isCore: true,
    } as any);

    const result = await service.createQuestionWithContent(2, 4, {
      title: 'Core title',
      questionGroupId: 8,
      type: 'mcq',
      questionStem: 'Pick one',
      questionData: validMcqData(),
      source: 'manual',
    } as any);

    expect(prisma.moduleUnitQuestionGroup.findFirst).toHaveBeenCalledWith({
      where: { id: 8, moduleUnitId: 4, isArchived: false },
    });
    expect(prisma.questionContent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionUnitId: 9,
        isCore: true,
        hint: null,
        isArchived: false,
      }),
    });
    expect(result.coreContent.id).toBe(21);
  });

  it('rejects invalid create-question-with-content inputs', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createQuestionWithContent(2, 4, {
        questionData: validMcqData(),
      } as any),
    ).rejects.toThrow('Module unit not found');

    prisma.moduleUnit.findUnique.mockResolvedValueOnce({
      id: 4,
      moduleId: 999,
    } as any);
    await expect(
      service.createQuestionWithContent(2, 4, {
        questionData: validMcqData(),
      } as any),
    ).rejects.toThrow('Module unit not found');

    prisma.moduleUnit.findUnique.mockResolvedValueOnce({
      id: 4,
      moduleId: 2,
    } as any);
    await expect(
      service.createQuestionWithContent(2, 4, {
        questionData: { options: [] },
      } as any),
    ).rejects.toThrow(BadRequestException);

    prisma.moduleUnit.findUnique.mockResolvedValueOnce({
      id: 4,
      moduleId: 2,
    } as any);
    prisma.moduleUnitQuestionGroup.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.createQuestionWithContent(2, 4, {
        questionGroupId: 99,
        questionData: validMcqData(),
      } as any),
    ).rejects.toThrow('Question group not found');
  });

  it('recovers when fallback group creation races with another request', async () => {
    const collision = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: '5.x',
    });
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 4,
      moduleId: 2,
    } as any);
    prisma.moduleUnitQuestionGroup.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 44 } as any);
    prisma.moduleUnitQuestionGroup.create.mockRejectedValueOnce(collision);
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    prisma.questionUnit.create.mockResolvedValue({
      id: 9,
      moduleUnitId: 4,
      questionGroupId: 44,
      title: 'Core title',
    } as any);
    prisma.questionContent.create.mockResolvedValue({
      id: 21,
      questionUnitId: 9,
      questionStem: 'Pick one',
      questionData: validMcqData(),
      type: 'mcq',
      hint: 'Hint',
      source: 'manual',
      isArchived: true,
      isCore: true,
    } as any);

    await service.createQuestionWithContent(2, 4, {
      title: 'Core title',
      type: 'mcq',
      questionStem: 'Pick one',
      questionData: validMcqData(),
      source: 'manual',
      hint: 'Hint',
      isArchived: true,
    } as any);

    expect(prisma.questionUnit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ questionGroupId: 44 }),
    });
  });

  it('rethrows fallback group creation errors when no concurrent group exists', async () => {
    const collision = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: '5.x',
    });
    prisma.moduleUnitQuestionGroup.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.moduleUnitQuestionGroup.create.mockRejectedValueOnce(collision);

    await expect(service.create({ moduleUnitId: 5, title: 'Q' })).rejects.toBe(
      collision,
    );
  });

  it('creates a variant with content after validating question ownership and data', async () => {
    prisma.questionUnit.findUnique.mockResolvedValue({
      id: 9,
      moduleUnitId: 4,
      questionGroupId: 8,
      moduleUnit: { id: 4, moduleId: 2 },
    } as any);
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    prisma.questionContent.create.mockResolvedValue({
      id: 22,
      questionUnitId: 9,
      questionStem: 'Variant stem',
      questionData: validMcqData(),
      type: 'mcq',
      hint: null,
      source: 'manual',
      isArchived: false,
    } as any);
    prisma.questionVariant.create.mockResolvedValue({
      id: 6,
      variantLabel: 'B',
      content: {
        id: 22,
        questionUnitId: 9,
        questionStem: 'Variant stem',
        questionData: validMcqData(),
        type: 'mcq',
        hint: null,
        source: 'manual',
        isArchived: false,
      },
    } as any);

    const result = await service.createVariantWithContent(2, 4, 9, {
      variantLabel: 'B',
      type: 'mcq',
      questionStem: 'Variant stem',
      questionData: validMcqData(),
      source: 'manual',
    } as any);

    expect(prisma.questionVariant.create).toHaveBeenCalledWith({
      data: { questionUnitId: 9, contentId: 22, variantLabel: 'B' },
      include: { content: true },
    });
    expect(result.variant.content.id).toBe(22);
  });

  it('rejects variant creation for missing/wrong questions or invalid data', async () => {
    prisma.questionUnit.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createVariantWithContent(2, 4, 9, {
        questionData: validMcqData(),
      } as any),
    ).rejects.toThrow('Question not found');

    prisma.questionUnit.findUnique.mockResolvedValueOnce({
      id: 9,
      moduleUnitId: 999,
      moduleUnit: { moduleId: 2 },
    } as any);
    await expect(
      service.createVariantWithContent(2, 4, 9, {
        questionData: validMcqData(),
      } as any),
    ).rejects.toThrow('Question not found');

    prisma.questionUnit.findUnique.mockResolvedValueOnce({
      id: 9,
      moduleUnitId: 4,
      moduleUnit: { moduleId: 2 },
    } as any);
    await expect(
      service.createVariantWithContent(2, 4, 9, {
        questionData: { options: [] },
      } as any),
    ).rejects.toThrow(BadRequestException);
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

  it('rejects scoped question removal when the question is missing, archived, or outside scope', async () => {
    prisma.questionUnit.findUnique.mockResolvedValueOnce(null);
    await expect(service.removeScoped(2, 4, 9)).rejects.toThrow(
      NotFoundException,
    );

    prisma.questionUnit.findUnique.mockResolvedValueOnce({
      id: 9,
      moduleUnitId: 4,
      isArchived: true,
      moduleUnit: { id: 4, moduleId: 2 },
    } as any);
    await expect(service.removeScoped(2, 4, 9)).rejects.toThrow(
      NotFoundException,
    );

    prisma.questionUnit.findUnique.mockResolvedValueOnce({
      id: 9,
      moduleUnitId: 999,
      isArchived: false,
      moduleUnit: { id: 999, moduleId: 2 },
    } as any);
    await expect(service.removeScoped(2, 4, 9)).rejects.toThrow(
      NotFoundException,
    );
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

  it('hard deletes variants for draft units without attempts and rejects out-of-scope variants', async () => {
    prisma.questionVariant.findUnique.mockResolvedValueOnce({
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
    prisma.questionAttempt.count.mockResolvedValueOnce(0);
    prisma.questionVariant.delete.mockResolvedValue({ id: 14 } as any);

    await service.removeVariantScoped(2, 4, 9, 14);
    expect(prisma.questionVariant.delete).toHaveBeenCalledWith({
      where: { id: 14 },
    });

    prisma.questionVariant.findUnique.mockResolvedValueOnce({
      id: 15,
      questionUnitId: 999,
      contentId: 22,
      questionUnit: {
        id: 999,
        moduleUnitId: 4,
        isArchived: false,
        moduleUnit: { id: 4, moduleId: 2 },
      },
    } as any);
    await expect(service.removeVariantScoped(2, 4, 9, 15)).rejects.toThrow(
      'Variant not found',
    );
  });

  it('updates scoped content after validating ownership and optional question data', async () => {
    prisma.questionContent.findUnique.mockResolvedValue({
      id: 21,
      questionUnitId: 9,
      questionUnit: {
        id: 9,
        moduleUnitId: 4,
        moduleUnit: { id: 4, moduleId: 2 },
      },
    } as any);
    prisma.questionContent.update.mockResolvedValue({
      id: 21,
      questionUnitId: 9,
      questionStem: 'Updated stem',
      questionData: validMcqData(),
      type: 'mcq',
      hint: 'Updated hint',
      source: 'manual',
      isArchived: false,
    } as any);

    const result = await service.updateContentScoped(2, 4, 9, 21, {
      questionStem: 'Updated stem',
      questionData: validMcqData(),
    } as any);

    expect(prisma.questionContent.update).toHaveBeenCalledWith({
      where: { id: 21 },
      data: {
        questionStem: 'Updated stem',
        questionData: validMcqData(),
      },
    });
    expect(result.questionStem).toBe('Updated stem');
  });

  it('rejects scoped content updates for missing content or invalid question data', async () => {
    prisma.questionContent.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateContentScoped(2, 4, 9, 21, {})).rejects.toThrow(
      'Question content not found',
    );

    prisma.questionContent.findUnique.mockResolvedValueOnce({
      id: 21,
      questionUnitId: 9,
      questionUnit: {
        id: 9,
        moduleUnitId: 4,
        moduleUnit: { id: 4, moduleId: 2 },
      },
    } as any);
    await expect(
      service.updateContentScoped(2, 4, 9, 21, {
        questionData: { options: [] },
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});

function validMcqData() {
  return {
    options: [
      { optionText: 'A' },
      { optionText: 'B' },
      { optionText: 'C' },
      { optionText: 'D' },
    ],
    correctOptionIndex: 1,
  };
}
