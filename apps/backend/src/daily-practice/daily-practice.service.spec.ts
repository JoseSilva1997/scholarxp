// Role: verifies the daily-practice facade loads generated sets, reuses sessions, and coordinates first-attempt FSRS updates.
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
import { DailyPracticeEligibilityService } from './daily-practice-eligibility.service';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
import { DailyPracticeFsrsStateService } from './daily-practice-fsrs-state.service';
import { DailyPracticeMasteryExpService } from './daily-practice-mastery-exp.service';
import { DailyPracticeMapper } from './daily-practice.mapper';
import { DailyPracticeService } from './daily-practice.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import type { PersistedDailyPracticeSetRecord } from './daily-practice.types';

describe('DailyPracticeService', () => {
  let service: DailyPracticeService;
  let prisma: PrismaMock;
  let dailyPracticeSetReadService: {
    findSetForUtcDay: jest.Mock;
    findOwnedSetById: jest.Mock;
  };
  let dailyPracticeFsrsGradeService: {
    mapEncounterToGrade: jest.Mock;
  };
  let dailyPracticeFsrsStateService: {
    applyEncounter: jest.Mock;
  };
  let dailyPracticeMasteryExpService: {
    evaluateAndAward: jest.Mock;
  };
  let dailyPracticeEligibilityService: {
    assertEligibleForToday: jest.Mock;
    checkEligibilityForToday: jest.Mock;
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
    prisma.user.findUnique.mockResolvedValue({ timezone: 'UTC' } as never);
    dailyPracticeSetReadService = {
      findSetForUtcDay: jest.fn(),
      findOwnedSetById: jest.fn(),
    };
    dailyPracticeFsrsGradeService = {
      mapEncounterToGrade: jest.fn(),
    };
    dailyPracticeFsrsStateService = {
      applyEncounter: jest.fn().mockResolvedValue({
        id: 'state-uuid',
        userId: 100,
        moduleId: 10,
        moduleUnitId: 20,
        questionUnitId: 30,
        fsrsState: 'learning',
        fsrsDifficulty: 0.3,
        fsrsStability: 1.0,
        fsrsDueAt: new Date(),
        fsrsLastReviewedAt: new Date(),
        reviewCount: 1,
        lapseCount: 0,
        lastGrade: 'good',
        lastSeenAt: new Date(),
        lastCorrectAt: new Date(),
        recentAvgTimeMs: 5000,
        firstSeenAt: new Date(),
        algorithmVersion: 'fsrs_v1',
      }),
    };
    dailyPracticeMasteryExpService = {
      evaluateAndAward: jest.fn().mockResolvedValue({ masteryExpAwarded: 0 }),
    };
    dailyPracticeEligibilityService = {
      assertEligibleForToday: jest.fn().mockResolvedValue(undefined),
      checkEligibilityForToday: jest.fn().mockResolvedValue({
        eligible: true,
      }),
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
          provide: DailyPracticeFsrsGradeService,
          useValue: dailyPracticeFsrsGradeService,
        },
        {
          provide: DailyPracticeFsrsStateService,
          useValue: dailyPracticeFsrsStateService,
        },
        {
          provide: DailyPracticeMasteryExpService,
          useValue: dailyPracticeMasteryExpService,
        },
        {
          provide: DailyPracticeEligibilityService,
          useValue: dailyPracticeEligibilityService,
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

  it('loads today set when one was already generated and returns the mapped response', async () => {
    const persistedSet = buildPersistedSet();
    const mappedResponse = { setId: persistedSet.id };

    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(
      persistedSet,
    );
    practiceRoomSessionService.resolveOwnedSessionByType.mockResolvedValue({
      id: 'session-1',
      sessionType: PracticeSessionTypeValues.dailyPractice,
      endTime: null,
    });
    prisma.questionContent.findMany.mockResolvedValue([
      {
        id: 601,
        questionUnitId: 101,
        type: 'mcq',
        questionStem: 'Variant stem',
        questionData: { correctOptionIndex: 0 },
        hint: 'Variant hint',
        questionUnit: {
          id: 101,
          moduleUnit: {
            id: 11,
            title: 'Lesson 1',
          },
        },
      },
    ] as never);
    prisma.questionAttempt.findMany.mockResolvedValue([] as never);
    dailyPracticeMapper.buildTodayResponse.mockReturnValue(mappedResponse);

    const result = await service.getTodayDailyPractice(7, 42);

    expect(
      dailyPracticeEligibilityService.assertEligibleForToday,
    ).toHaveBeenCalledWith(7, 42, expect.any(Date), 'UTC');
    expect(dailyPracticeSetReadService.findSetForUtcDay).toHaveBeenCalledWith(
      42,
      7,
      expect.any(Date),
      'UTC',
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

  it('returns no-set when today has not been generated yet', async () => {
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(null);

    await expect(service.getTodayDailyPractice(7, 42)).rejects.toThrow(
      'No daily practice questions are available for this module yet.',
    );

    expect(
      practiceRoomSessionService.resolveOwnedSessionByType,
    ).not.toHaveBeenCalled();
    expect(prisma.dailyPracticeSet.create).not.toHaveBeenCalled();
  });

  it('returns no-set when today only has the empty sentinel row', async () => {
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue({
      ...buildPersistedSet(),
      items: [],
    });

    await expect(service.getTodayDailyPractice(7, 42)).rejects.toThrow(
      'No daily practice questions are available for this module yet.',
    );

    expect(
      practiceRoomSessionService.resolveOwnedSessionByType,
    ).not.toHaveBeenCalled();
  });

  it('blocks today-set access until the module is eligible for daily practice', async () => {
    dailyPracticeEligibilityService.assertEligibleForToday.mockRejectedValue(
      new Error(
        'Daily practice unlocks tomorrow after you complete your first lesson in this module.',
      ),
    );

    await expect(service.getTodayDailyPractice(7, 42)).rejects.toThrow(
      'Daily practice unlocks tomorrow after you complete your first lesson in this module.',
    );
    expect(dailyPracticeSetReadService.findSetForUtcDay).not.toHaveBeenCalled();
  });

  it('summarizes daily practice status for locked, no-set, completed, available, and in-progress days', async () => {
    dailyPracticeEligibilityService.checkEligibilityForToday
      .mockResolvedValueOnce({
        eligible: false,
        message: 'Daily practice unlocks tomorrow.',
      })
      .mockResolvedValue({ eligible: true });

    await expect(service.getDailyPracticeStatus(7, 42)).resolves.toEqual({
      status: 'locked',
      message: 'Daily practice unlocks tomorrow.',
    });

    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValueOnce(null);
    await expect(service.getDailyPracticeStatus(7, 42)).resolves.toEqual({
      status: 'no_set',
      message: 'No daily practice questions are available for this module yet.',
    });

    const completedSet = {
      ...buildPersistedSet(),
      completedAt: new Date('2026-03-20T10:00:00.000Z'),
    };
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValueOnce(
      completedSet,
    );
    await expect(service.getDailyPracticeStatus(7, 42)).resolves.toEqual({
      status: 'completed',
      progress: {
        totalQuestions: 1,
        answeredQuestions: 1,
        completedAt: completedSet.completedAt.toISOString(),
      },
    });

    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValueOnce(
      buildPersistedSet(),
    );
    prisma.questionAttempt.findMany.mockResolvedValueOnce([] as never);
    await expect(service.getDailyPracticeStatus(7, 42)).resolves.toMatchObject({
      status: 'available',
      progress: { totalQuestions: 1, answeredQuestions: 0 },
    });

    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValueOnce(
      buildPersistedSet(),
    );
    prisma.questionAttempt.findMany.mockResolvedValueOnce([
      { questionId: 101 },
    ] as never);
    await expect(service.getDailyPracticeStatus(7, 42)).resolves.toMatchObject({
      status: 'in_progress',
      progress: { totalQuestions: 1, answeredQuestions: 1 },
    });
  });

  it('throws when persisted daily-practice content can no longer be hydrated', async () => {
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(
      buildPersistedSet(),
    );
    practiceRoomSessionService.resolveOwnedSessionByType.mockResolvedValue({
      id: 'session-1',
      sessionType: PracticeSessionTypeValues.dailyPractice,
      endTime: null,
    });
    prisma.questionContent.findMany.mockResolvedValue([] as never);
    prisma.questionAttempt.findMany.mockResolvedValue([] as never);

    await expect(service.getTodayDailyPractice(7, 42)).rejects.toThrow(
      'Daily practice question content is no longer available.',
    );
  });

  it('closes a daily-practice session and returns the latest hydrated progress', async () => {
    const persistedSet = buildPersistedSet();
    const closedAt = new Date('2026-03-20T10:00:00.000Z');
    practiceRoomSessionService.closeOwnedSession.mockResolvedValue({
      sessionId: 'session-1',
      closedAt,
    });
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(
      persistedSet,
    );
    prisma.questionContent.findMany.mockResolvedValue([
      {
        id: 601,
        questionUnitId: 101,
        type: 'mcq',
        questionStem: 'Variant stem',
        questionData: { correctOptionIndex: 0 },
        hint: null,
        questionUnit: {
          id: 101,
          moduleUnit: { id: 11, title: 'Lesson 1' },
        },
      },
    ] as never);
    prisma.questionAttempt.findMany.mockResolvedValue([
      {
        questionId: 101,
        studentAnswer: { selectedOptionIndex: 0 },
        isCorrect: true,
        attemptedAt: closedAt,
        hintsUsed: 0,
      },
    ] as never);
    dailyPracticeMapper.buildCloseResponse.mockReturnValue({
      sessionId: 'session-1',
    });

    const result = await service.closeSession(7, 42, 'session-1');

    expect(practiceRoomSessionService.closeOwnedSession).toHaveBeenCalledWith(
      7,
      42,
      'session-1',
    );
    expect(dailyPracticeMapper.buildCloseResponse).toHaveBeenCalledWith({
      sessionId: 'session-1',
      closedAt,
      progress: {
        totalQuestions: 1,
        answeredQuestions: 1,
        completedAt: null,
      },
    });
    expect(result).toEqual({ sessionId: 'session-1' });
  });

  it('rejects close when the module has no daily-practice set today', async () => {
    practiceRoomSessionService.closeOwnedSession.mockResolvedValue({
      sessionId: 'session-1',
      closedAt: new Date(),
    });
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(null);

    await expect(service.closeSession(7, 42, 'session-1')).rejects.toThrow(
      'Daily practice set not found for this module.',
    );
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
      questionContentId: 601,
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
    expect(
      practiceRoomAttemptService.computeIsCorrectForPayload,
    ).toHaveBeenCalledWith(
      11,
      101,
      601,
      { selectedOptionIndex: 0 },
      { allowVariantContent: true },
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
    expect(dailyPracticeFsrsStateService.applyEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        moduleId: 7,
        moduleUnitId: 11,
        questionUnitId: 101,
        firstAttemptCorrect: true,
        timezone: 'UTC',
        priorEncounterExists: false,
      }),
      tx,
    );
    expect(dailyPracticeMasteryExpService.evaluateAndAward).toHaveBeenCalled();
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

  it('skips mastery XP evaluation when applyEncounter defers state creation on a first-incorrect attempt', async () => {
    const persistedSet = buildPersistedSet();
    const tx = createPrismaMock();
    const mappedResponse = { hasCorrectAttempt: false };

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
      false,
    );
    dailyPracticeFsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.again,
    );
    practiceRoomAttemptService.createAttemptRecord.mockResolvedValue({
      id: 1,
    });
    // Policy defers state creation on first-incorrect encounters, returning null so mastery XP must not be evaluated.
    dailyPracticeFsrsStateService.applyEncounter.mockResolvedValue(null);
    tx.questionAttempt.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.questionAttempt.findMany.mockResolvedValue([] as never);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    dailyPracticeMapper.buildSubmitResponse.mockReturnValue(mappedResponse);

    await service.submitAttempt(7, 42, {
      setId: persistedSet.id,
      moduleUnitId: 11,
      questionUnitId: 101,
      questionContentId: 601,
      sessionId: 'session-1',
      timeTakenMs: 9000,
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 0 },
    });

    expect(dailyPracticeFsrsStateService.applyEncounter).toHaveBeenCalledTimes(
      1,
    );
    expect(
      dailyPracticeMasteryExpService.evaluateAndAward,
    ).not.toHaveBeenCalled();
    expect(dailyPracticeMapper.buildSubmitResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        awards: expect.objectContaining({ masteryExp: 0 }),
      }),
    );
  });

  it('forwards priorEncounterExists=true on later same-day attempts so the state service can still seed late-correct cards', async () => {
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
    // State service decides whether to seed late or skip — the facade only forwards the flag.
    dailyPracticeFsrsStateService.applyEncounter.mockResolvedValue({
      id: 'state-late-seed',
    });
    // Both pre-submit findFirst calls return a prior daily attempt to model the late-correct scenario.
    tx.questionAttempt.findFirst
      .mockResolvedValueOnce({ id: 99 } as never)
      .mockResolvedValueOnce(null);
    tx.questionAttempt.findMany.mockResolvedValue([
      { questionId: 101 },
    ] as never);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    dailyPracticeMapper.buildSubmitResponse.mockReturnValue(mappedResponse);

    await service.submitAttempt(7, 42, {
      setId: persistedSet.id,
      moduleUnitId: 11,
      questionUnitId: 101,
      questionContentId: 601,
      sessionId: 'session-1',
      timeTakenMs: 9000,
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 0 },
    });

    expect(dailyPracticeFsrsStateService.applyEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        questionUnitId: 101,
        firstAttemptCorrect: true,
        priorEncounterExists: true,
      }),
      tx,
    );
    // State service returned a seeded card, so mastery XP fires.
    expect(dailyPracticeMasteryExpService.evaluateAndAward).toHaveBeenCalled();
  });

  it('rejects submits whose content id does not match the persisted daily-practice item', async () => {
    const persistedSet = buildPersistedSet();

    dailyPracticeSetReadService.findOwnedSetById.mockResolvedValue(
      persistedSet,
    );

    await expect(
      service.submitAttempt(7, 42, {
        setId: persistedSet.id,
        moduleUnitId: 11,
        questionUnitId: 101,
        questionContentId: 999,
        sessionId: 'session-1',
        timeTakenMs: 9000,
        hintUnlocked: false,
        studentAnswer: { selectedOptionIndex: 0 },
      }),
    ).rejects.toThrow(
      'Submitted question content does not match the daily practice set.',
    );

    expect(
      practiceRoomAttemptService.computeIsCorrectForPayload,
    ).not.toHaveBeenCalled();
  });

  it('rejects submits when the set or item is not owned by the module/student', async () => {
    dailyPracticeSetReadService.findOwnedSetById.mockResolvedValueOnce(null);
    await expect(
      service.submitAttempt(7, 42, {
        setId: 'missing-set',
        moduleUnitId: 11,
        questionUnitId: 101,
        questionContentId: 601,
        sessionId: 'session-1',
        timeTakenMs: 9000,
        hintUnlocked: false,
        studentAnswer: { selectedOptionIndex: 0 },
      }),
    ).rejects.toThrow('Daily practice set not found for this module.');

    dailyPracticeSetReadService.findOwnedSetById.mockResolvedValueOnce(
      buildPersistedSet(),
    );
    await expect(
      service.submitAttempt(7, 42, {
        setId: buildPersistedSet().id,
        moduleUnitId: 999,
        questionUnitId: 101,
        questionContentId: 601,
        sessionId: 'session-1',
        timeTakenMs: 9000,
        hintUnlocked: false,
        studentAnswer: { selectedOptionIndex: 0 },
      }),
    ).rejects.toThrow("Question not found in today's daily practice set.");
  });

  it('preserves completedAt and skips redundant progress writes for already-completed sets', async () => {
    const completedAt = new Date('2026-03-20T10:00:00.000Z');
    const persistedSet = { ...buildPersistedSet(), completedAt };
    const tx = createPrismaMock();
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
      false,
    );
    dailyPracticeFsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.again,
    );
    practiceRoomAttemptService.createAttemptRecord.mockResolvedValue({ id: 1 });
    dailyPracticeFsrsStateService.applyEncounter.mockResolvedValue(null);
    tx.questionAttempt.findFirst
      .mockResolvedValueOnce({ id: 1 } as never)
      .mockResolvedValueOnce({ id: 2 } as never);
    tx.questionAttempt.findMany.mockResolvedValue([
      { questionId: 101, isCorrect: false, hintsUsed: 1 },
    ] as never);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    dailyPracticeMapper.buildSubmitResponse.mockReturnValue({
      completedAt,
    });

    await service.submitAttempt(7, 42, {
      setId: persistedSet.id,
      moduleUnitId: 11,
      questionUnitId: 101,
      questionContentId: 601,
      sessionId: 'session-1',
      timeTakenMs: 9000,
      hintUnlocked: true,
      studentAnswer: { selectedOptionIndex: 1 },
    });

    expect(tx.dailyPracticeSet.update).not.toHaveBeenCalled();
    expect(dailyPracticeMapper.buildSubmitResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        hasCorrectAttempt: true,
        progress: expect.objectContaining({ completedAt }),
      }),
    );
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
        questionContentId: 601,
        moduleUnitId: 11,
        position: 0,
        selectionReason: 'Overdue review item.',
        selectionScore: 10,
        sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
      },
    ],
  };
}
