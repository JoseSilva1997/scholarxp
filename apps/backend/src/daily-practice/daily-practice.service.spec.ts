// Role: verifies the daily-practice facade coordinates set creation, session reuse, and first-attempt FSRS updates without duplicating lower-level policies.
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DailyPracticeSelectionBucketValues,
  FsrsReviewGradeValues,
  PracticeSessionTypeValues,
} from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeRoomAttemptService } from '../practice-room/practice-room-attempt.service';
import { PracticeRoomSessionService } from '../practice-room/practice-session.service';
import { QuestProgressService } from '../quests/quest-progress.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
import { DailyPracticeFsrsStateService } from './daily-practice-fsrs-state.service';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import { DailyPracticeMapper } from './daily-practice.mapper';
import { DailyPracticeService } from './daily-practice.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import type {
  OrderedDailyPracticeQuestionRecord,
  PersistedDailyPracticeSetRecord,
} from './daily-practice.types';

describe('DailyPracticeService', () => {
  let service: DailyPracticeService;
  let prisma: PrismaMock;
  let dailyPracticeSetReadService: {
    findSetForUtcDay: jest.Mock;
    findSetById: jest.Mock;
    findOwnedSetById: jest.Mock;
  };
  let dailyPracticeSetSelectorService: {
    selectQuestions: jest.Mock;
  };
  let dailyPracticeInterleavingService: {
    orderSelectedQuestions: jest.Mock;
  };
  let dailyPracticeFsrsGradeService: {
    mapEncounterToGrade: jest.Mock;
  };
  let dailyPracticeFsrsStateService: {
    applyEncounter: jest.Mock;
  };
  let dailyPracticeMapper: {
    buildTodayResponse: jest.Mock;
    buildSubmitResponse: jest.Mock;
    buildCloseResponse: jest.Mock;
  };
  let practiceRoomAttemptService: {
    computeIsCorrectForPayload: jest.Mock;
    createAttemptRecord: jest.Mock;
  };
  let practiceRoomSessionService: {
    resolveOwnedSessionByType: jest.Mock;
    getOwnedPracticeSessionOrThrow: jest.Mock;
    assertSessionMatchesType: jest.Mock;
    assertSessionAllowsSubmissions: jest.Mock;
    closeOwnedSession: jest.Mock;
  };
  let questProgressService: {
    recordDailyPracticeSetProgress: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    dailyPracticeSetReadService = {
      findSetForUtcDay: jest.fn(),
      findSetById: jest.fn(),
      findOwnedSetById: jest.fn(),
    };
    dailyPracticeSetSelectorService = {
      selectQuestions: jest.fn(),
    };
    dailyPracticeInterleavingService = {
      orderSelectedQuestions: jest.fn(),
    };
    dailyPracticeFsrsGradeService = {
      mapEncounterToGrade: jest.fn(),
    };
    dailyPracticeFsrsStateService = {
      applyEncounter: jest.fn(),
    };
    dailyPracticeMapper = {
      buildTodayResponse: jest.fn(),
      buildSubmitResponse: jest.fn(),
      buildCloseResponse: jest.fn(),
    };
    practiceRoomAttemptService = {
      computeIsCorrectForPayload: jest.fn(),
      createAttemptRecord: jest.fn(),
    };
    practiceRoomSessionService = {
      resolveOwnedSessionByType: jest.fn(),
      getOwnedPracticeSessionOrThrow: jest.fn(),
      assertSessionMatchesType: jest.fn(),
      assertSessionAllowsSubmissions: jest.fn(),
      closeOwnedSession: jest.fn(),
    };
    questProgressService = {
      // Quest progress is mocked separately so this facade test can assert the bridge without re-testing quest rules.
      recordDailyPracticeSetProgress: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: DailyPracticeSetReadService,
          useValue: dailyPracticeSetReadService,
        },
        {
          provide: DailyPracticeSetSelectorService,
          useValue: dailyPracticeSetSelectorService,
        },
        {
          provide: DailyPracticeInterleavingService,
          useValue: dailyPracticeInterleavingService,
        },
        {
          provide: DailyPracticeFsrsGradeService,
          useValue: dailyPracticeFsrsGradeService,
        },
        {
          provide: DailyPracticeFsrsStateService,
          useValue: dailyPracticeFsrsStateService,
        },
        { provide: DailyPracticeMapper, useValue: dailyPracticeMapper },
        {
          provide: PracticeRoomAttemptService,
          useValue: practiceRoomAttemptService,
        },
        {
          provide: PracticeRoomSessionService,
          useValue: practiceRoomSessionService,
        },
        {
          provide: QuestProgressService,
          useValue: questProgressService,
        },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates today set on first load and returns the mapped response', async () => {
    const persistedSet = buildPersistedSet();
    const orderedQuestions = [buildOrderedQuestion()];
    const mappedResponse = { setId: persistedSet.id };

    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValueOnce(null);
    dailyPracticeSetSelectorService.selectQuestions.mockResolvedValue({
      plan: {
        targetQuestionCount: 7,
        dueReviewQuota: 4,
        newSequenceQuota: 2,
        reinforcementQuota: 1,
      },
      selectedQuestions: orderedQuestions,
    });
    dailyPracticeInterleavingService.orderSelectedQuestions.mockReturnValue(
      orderedQuestions,
    );
    prisma.dailyPracticeSet.create.mockResolvedValue({
      id: persistedSet.id,
    } as never);
    dailyPracticeSetReadService.findSetById.mockResolvedValue(persistedSet);
    practiceRoomSessionService.resolveOwnedSessionByType.mockResolvedValue({
      id: 'session-1',
      sessionType: PracticeSessionTypeValues.dailyPractice,
      endTime: null,
    });
    prisma.questionUnit.findMany.mockResolvedValue([
      {
        id: 101,
        moduleUnitId: 11,
        contents: [
          {
            id: 501,
            type: 'mcq',
            questionStem: 'Question stem',
            questionData: { correctOptionIndex: 0 },
            hint: 'Hint',
            difficultyScore: 0.5,
          },
        ],
        moduleUnit: {
          id: 11,
          title: 'Lesson 1',
        },
      },
    ] as never);
    prisma.questionAttempt.findMany.mockResolvedValue([] as never);
    dailyPracticeMapper.buildTodayResponse.mockReturnValue(mappedResponse);

    const result = await service.getTodayDailyPractice(7, 42);

    expect(
      dailyPracticeSetSelectorService.selectQuestions,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        moduleId: 7,
      }),
    );
    expect(prisma.dailyPracticeSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 42,
          moduleId: 7,
          items: {
            create: [
              expect.objectContaining({
                questionUnitId: 101,
                moduleUnitId: 11,
                position: 0,
              }),
            ],
          },
        }),
      }),
    );
    expect(
      practiceRoomSessionService.resolveOwnedSessionByType,
    ).toHaveBeenCalledWith(
      7,
      42,
      PracticeSessionTypeValues.dailyPractice,
      undefined,
    );
    expect(result).toBe(mappedResponse);
  });

  it('submits the first daily attempt, updates FSRS once, and syncs set progress', async () => {
    const persistedSet = buildPersistedSet();
    const tx = createPrismaMock();
    const mappedResponse = { hasCorrectAttempt: true };

    dailyPracticeSetReadService.findOwnedSetById.mockResolvedValue(
      persistedSet,
    );
    practiceRoomSessionService.getOwnedPracticeSessionOrThrow.mockResolvedValue(
      {
        id: 'session-1',
        sessionType: PracticeSessionTypeValues.dailyPractice,
        endTime: null,
      },
    );
    practiceRoomAttemptService.computeIsCorrectForPayload.mockResolvedValue(
      true,
    );
    dailyPracticeFsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.good,
    );
    practiceRoomAttemptService.createAttemptRecord.mockResolvedValue({
      id: 1,
    });
    dailyPracticeFsrsStateService.applyEncounter.mockResolvedValue({
      id: 'state-1',
    });
    tx.questionAttempt.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.questionAttempt.findMany.mockResolvedValue([
      { questionId: 101 },
    ] as never);
    tx.dailyPracticeSet.update.mockResolvedValue({
      id: persistedSet.id,
    } as never);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    dailyPracticeMapper.buildSubmitResponse.mockReturnValue(mappedResponse);

    const result = await service.submitAttempt(7, 42, {
      setId: persistedSet.id,
      moduleUnitId: 11,
      questionUnitId: 101,
      questionContentId: 501,
      sessionId: 'session-1',
      timeTakenMs: 9000,
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 0 },
    });

    expect(
      practiceRoomSessionService.assertSessionMatchesType,
    ).toHaveBeenCalledWith(
      PracticeSessionTypeValues.dailyPractice,
      PracticeSessionTypeValues.dailyPractice,
    );
    expect(practiceRoomAttemptService.createAttemptRecord).toHaveBeenCalledWith(
      11,
      42,
      expect.objectContaining({
        questionUnitId: 101,
        sessionId: 'session-1',
      }),
      true,
      expect.any(Date),
      tx,
    );
    expect(dailyPracticeFsrsStateService.applyEncounter).toHaveBeenCalledTimes(
      1,
    );
    expect(tx.dailyPracticeSet.update).toHaveBeenCalledWith({
      where: { id: persistedSet.id },
      data: { completedAt: expect.any(Date) },
    });
    expect(
      questProgressService.recordDailyPracticeSetProgress,
    ).toHaveBeenCalledWith(
      {
        userId: 42,
        moduleId: 7,
        progressedAt: expect.any(Date),
      },
      tx,
    );
    expect(dailyPracticeMapper.buildSubmitResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        hasCorrectAttempt: true,
        encounterGrade: FsrsReviewGradeValues.good,
        progress: expect.objectContaining({
          totalQuestions: 1,
          answeredQuestions: 1,
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(result).toBe(mappedResponse);
  });
});

function buildPersistedSet(): PersistedDailyPracticeSetRecord {
  return {
    id: '6aa2bc03-a0ee-4ebc-84c5-d6a53b889900',
    userId: 42,
    moduleId: 7,
    practiceDateUtc: new Date('2026-03-20T00:00:00.000Z'),
    generatedAt: new Date('2026-03-20T09:00:00.000Z'),
    completedAt: null,
    algorithmVersion: 'fsrs_v1',
    items: [
      {
        id: 'item-1',
        dailyPracticeSetId: '6aa2bc03-a0ee-4ebc-84c5-d6a53b889900',
        questionUnitId: 101,
        moduleUnitId: 11,
        position: 0,
        selectionReason: 'Overdue review item.',
        selectionScore: 10,
        sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
      },
    ],
  };
}

function buildOrderedQuestion(): OrderedDailyPracticeQuestionRecord {
  return {
    moduleUnitId: 11,
    moduleUnitTitle: 'Lesson 1',
    moduleUnitSortOrder: 1,
    questionUnitId: 101,
    questionUnitTitle: 'Question 101',
    questionGroupId: 1,
    questionGroupSortOrder: 1,
    coreContentId: 501,
    questionType: 'multiple_choice',
    questionDifficultyScore: 0.5,
    sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
    selectionScore: 10,
    selectionReason: 'Overdue review item.',
    studentQuestionState: null,
    position: 0,
  };
}
