// Role: verifies that listModuleCandidateQuestions correctly maps Prisma results and skips question units with no core content.
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';

describe('DailyPracticeCandidateReadService', () => {
  let service: DailyPracticeCandidateReadService;
  let prisma: { moduleUnit: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { moduleUnit: { findMany: jest.fn() } };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeCandidateReadService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeCandidateReadService);
  });

  it('returns a candidate for each question unit that has core content', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([
      buildModuleUnit(1, 'Lesson A', 0, [
        buildQuestionUnit(10, 'Q10', 100, { sortOrder: 1 }, [
          buildContent(1001, 'multiple_choice'),
        ]),
        buildQuestionUnit(11, 'Q11', 100, { sortOrder: 1 }, [
          buildContent(1002, 'free_response'),
        ]),
      ]),
    ]);

    const result = await service.listModuleCandidateQuestions(7);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      moduleUnitId: 1,
      moduleUnitTitle: 'Lesson A',
      moduleUnitSortOrder: 0,
      questionUnitId: 10,
      questionUnitTitle: 'Q10',
      questionGroupId: 100,
      questionGroupSortOrder: 1,
      coreContentId: 1001,
      questionType: 'multiple_choice',
    });
    expect(result[1]).toMatchObject({
      questionUnitId: 11,
      coreContentId: 1002,
      questionType: 'free_response',
    });
  });

  it('skips question units whose contents array is empty', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([
      buildModuleUnit(1, 'Lesson A', 0, [
        buildQuestionUnit(10, 'Q10', null, null, []),
        buildQuestionUnit(11, 'Q11', null, null, [
          buildContent(1001, 'multiple_choice'),
        ]),
      ]),
    ]);

    const result = await service.listModuleCandidateQuestions(7);

    expect(result).toHaveLength(1);
    expect(result[0].questionUnitId).toBe(11);
  });

  it('returns an empty array when no module units exist', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([]);

    const result = await service.listModuleCandidateQuestions(7);

    expect(result).toEqual([]);
  });

  it('returns an empty array when all question units have no core content', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([
      buildModuleUnit(1, 'Lesson A', 0, [
        buildQuestionUnit(10, 'Q10', null, null, []),
      ]),
    ]);

    const result = await service.listModuleCandidateQuestions(7);

    expect(result).toEqual([]);
  });

  it('maps null questionGroup to null questionGroupSortOrder', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([
      buildModuleUnit(1, 'Lesson A', 0, [
        buildQuestionUnit(10, 'Q10', null, null, [
          buildContent(1001, 'multiple_choice'),
        ]),
      ]),
    ]);

    const result = await service.listModuleCandidateQuestions(7);

    expect(result[0].questionGroupId).toBeNull();
    expect(result[0].questionGroupSortOrder).toBeNull();
  });

  it('uses the provided transaction client instead of the injected prisma', async () => {
    const txClient = {
      moduleUnit: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await service.listModuleCandidateQuestions(7, txClient as any);

    expect(txClient.moduleUnit.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.moduleUnit.findMany).not.toHaveBeenCalled();
  });

  it('queries with the correct moduleId and live status filter', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([]);

    await service.listModuleCandidateQuestions(42);

    expect(prisma.moduleUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moduleId: 42, status: 'live' },
      }),
    );
  });

  it('flattens question units across multiple module units preserving order', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([
      buildModuleUnit(1, 'Lesson A', 0, [
        buildQuestionUnit(10, 'Q10', null, null, [
          buildContent(1001, 'multiple_choice'),
        ]),
      ]),
      buildModuleUnit(2, 'Lesson B', 1, [
        buildQuestionUnit(20, 'Q20', null, null, [
          buildContent(2001, 'multiple_choice'),
        ]),
      ]),
    ]);

    const result = await service.listModuleCandidateQuestions(7);

    expect(result).toHaveLength(2);
    expect(result[0].moduleUnitId).toBe(1);
    expect(result[1].moduleUnitId).toBe(2);
  });
});

// ── Builders ──────────────────────────────────────────────────────────────────

function buildContent(id: number, type: string): { id: number; type: string } {
  return { id, type };
}

function buildQuestionUnit(
  id: number,
  title: string,
  questionGroupId: number | null,
  questionGroup: { sortOrder: number } | null,
  contents: ReturnType<typeof buildContent>[],
): {
  id: number;
  title: string;
  questionGroupId: number | null;
  questionGroup: { sortOrder: number } | null;
  contents: ReturnType<typeof buildContent>[];
} {
  return { id, title, questionGroupId, questionGroup, contents };
}

function buildModuleUnit(
  id: number,
  title: string,
  sortOrder: number,
  questionUnits: ReturnType<typeof buildQuestionUnit>[],
): {
  id: number;
  title: string;
  sortOrder: number;
  questionUnits: ReturnType<typeof buildQuestionUnit>[];
} {
  return { id, title, sortOrder, questionUnits };
}
