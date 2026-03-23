/* Test role: verifies PracticeRoomService stays an orchestration facade by
 asserting collaborator coordination instead of re-testing extracted internals.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import { MODULE_UNIT_BASELINE_EXP } from '@scholarxp/constants';
import { DailyPracticeFsrsStateService } from '../daily-practice/daily-practice-fsrs-state.service';
import { PracticeRoomService } from './practice-room.service';
import { PracticeRoomAttemptService } from './practice-room-attempt.service';
import { PracticeRoomMapper } from './practice-room.mapper';
import { PracticeRoomReadService } from './practice-room-read.service';
import { PracticeRoomSessionService } from './practice-session.service';
import {
  buildLoadedModuleUnit,
  buildOwnedPracticeSession,
  buildQuestionUnitDraft,
  buildSubmitAttemptPayload,
  TEST_MODULE_ID,
  TEST_MODULE_UNIT_ID,
  TEST_SESSION_ID,
  TEST_STUDENT_ID,
} from './practice-room.test-helpers';
import { StudentModuleUnitProgressService } from './student-module-unit-progress.service';
import { ExpAwardingService } from '../exp-engine/exp-awarding.service';
import { ExpStreakService } from '../exp-engine/exp-streak.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuestProgressService } from '../quests/quest-progress.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';

describe('PracticeRoomService', () => {
  let service: PracticeRoomService;
  let prisma: PrismaMock;
  let practiceRoomReadService: {
    loadRoomContext: jest.Mock;
    getLatestAttemptMap: jest.Mock;
    getModuleProgressSnapshot: jest.Mock;
    getQuestionRewardStateMap: jest.Mock;
    getClaimedStreakTiers: jest.Mock;
    assertModuleUnitAllowsSubmissions: jest.Mock;
    getModuleUnitOrThrow: jest.Mock;
  };
  let practiceRoomSessionService: {
    getOwnedPracticeSessionOrThrow: jest.Mock;
    assertSessionAllowsSubmissions: jest.Mock;
    closeSessionOnCompletionIfNeeded: jest.Mock;
    closeOwnedSession: jest.Mock;
    closeStaleSessions: jest.Mock;
  };
  let practiceRoomAttemptService: {
    validateModuleUnitPayload: jest.Mock;
    computeIsCorrectForPayload: jest.Mock;
    hasAnyAttempt: jest.Mock;
    hasAnySessionAttempt: jest.Mock;
    hasAnyCorrectAttempt: jest.Mock;
    createAttemptRecord: jest.Mock;
    resolveSubmitAwardReasons: jest.Mock;
  };
  let practiceRoomMapper: {
    buildResponse: jest.Mock;
  };
  let studentModuleUnitProgressService: {
    syncFromAttempts: jest.Mock;
  };
  let expAwardingService: {
    awardAttemptModuleExp: jest.Mock;
    awardCompletionExp: jest.Mock;
  };
  let expStreakService: {
    getSessionStreak: jest.Mock;
    getHistoricalHighestPracticeStreak: jest.Mock;
  };
  let questProgressService: {
    recordModuleUnitCompletion: jest.Mock;
    recordRetrySessionProgress: jest.Mock;
  };
  let dailyPracticeFsrsStateService: {
    applyEncounter: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    // Transaction callback mode keeps orchestration tests deterministic without a real database.
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(prisma),
    );

    practiceRoomReadService = {
      loadRoomContext: jest.fn(),
      getLatestAttemptMap: jest.fn(),
      getModuleProgressSnapshot: jest.fn(),
      getQuestionRewardStateMap: jest.fn(),
      getClaimedStreakTiers: jest.fn(),
      assertModuleUnitAllowsSubmissions: jest.fn(),
      getModuleUnitOrThrow: jest.fn(),
    };
    practiceRoomSessionService = {
      getOwnedPracticeSessionOrThrow: jest.fn(),
      assertSessionAllowsSubmissions: jest.fn(),
      closeSessionOnCompletionIfNeeded: jest.fn(),
      closeOwnedSession: jest.fn(),
      closeStaleSessions: jest.fn(),
    };
    practiceRoomAttemptService = {
      validateModuleUnitPayload: jest.fn(),
      computeIsCorrectForPayload: jest.fn(),
      hasAnyAttempt: jest.fn(),
      hasAnySessionAttempt: jest.fn(),
      hasAnyCorrectAttempt: jest.fn(),
      createAttemptRecord: jest.fn(),
      resolveSubmitAwardReasons: jest.fn(),
    };
    practiceRoomMapper = {
      buildResponse: jest.fn(),
    };
    studentModuleUnitProgressService = {
      syncFromAttempts: jest.fn(),
    };
    expAwardingService = {
      awardAttemptModuleExp: jest.fn(),
      awardCompletionExp: jest.fn(),
    };
    expStreakService = {
      getSessionStreak: jest.fn(),
      getHistoricalHighestPracticeStreak: jest.fn(),
    };
    questProgressService = {
      recordModuleUnitCompletion: jest.fn(),
      recordRetrySessionProgress: jest.fn(),
    };
    dailyPracticeFsrsStateService = {
      applyEncounter: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeRoomService,
        { provide: PracticeRoomReadService, useValue: practiceRoomReadService },
        {
          provide: PracticeRoomSessionService,
          useValue: practiceRoomSessionService,
        },
        {
          provide: PracticeRoomAttemptService,
          useValue: practiceRoomAttemptService,
        },
        { provide: PracticeRoomMapper, useValue: practiceRoomMapper },
        {
          provide: StudentModuleUnitProgressService,
          useValue: studentModuleUnitProgressService,
        },
        { provide: ExpAwardingService, useValue: expAwardingService },
        { provide: ExpStreakService, useValue: expStreakService },
        { provide: QuestProgressService, useValue: questProgressService },
        {
          provide: DailyPracticeFsrsStateService,
          useValue: dailyPracticeFsrsStateService,
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PracticeRoomService>(PracticeRoomService);
  });

  describe('getPracticeRoom', () => {
    it('coordinates room-load collaborators and returns the mapper response', async () => {
      const roomContext = {
        moduleUnit: buildLoadedModuleUnit(),
        isReadOnly: false,
        session: buildOwnedPracticeSession(),
        questionUnitDrafts: [buildQuestionUnitDraft()],
      };
      const mappedResponse = {
        practiceRoom: {
          sessionId: roomContext.session.id,
          moduleUnitId: roomContext.moduleUnit.id,
          moduleUnitTitle: roomContext.moduleUnit.title,
          questions: [],
        },
      };

      practiceRoomReadService.loadRoomContext.mockResolvedValue(roomContext);
      practiceRoomReadService.getLatestAttemptMap.mockResolvedValue(new Map());
      practiceRoomReadService.getModuleProgressSnapshot.mockResolvedValue({
        id: TEST_MODULE_ID,
      });
      practiceRoomReadService.getQuestionRewardStateMap.mockResolvedValue(
        new Map(),
      );
      practiceRoomReadService.getClaimedStreakTiers.mockResolvedValue([3]);
      expStreakService.getSessionStreak.mockResolvedValue({
        currentStreak: 2,
        highestStreak: 4,
      });
      practiceRoomMapper.buildResponse.mockReturnValue(mappedResponse);

      const result = await service.getPracticeRoom(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
      );

      expect(practiceRoomReadService.loadRoomContext).toHaveBeenCalledWith(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        undefined,
        undefined,
      );
      expect(expStreakService.getSessionStreak).toHaveBeenCalledWith(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        TEST_SESSION_ID,
      );
      expect(practiceRoomMapper.buildResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: TEST_SESSION_ID,
          moduleUnitTitle: roomContext.moduleUnit.title,
          currentStreak: 2,
          highestStreak: 4,
        }),
      );
      expect(result).toBe(mappedResponse);
    });

    it('uses the historical lesson streak when loading viewAnswers mode', async () => {
      const roomContext = {
        moduleUnit: buildLoadedModuleUnit(),
        isReadOnly: true,
        session: buildOwnedPracticeSession({
          sessionType: PracticeSessionTypeValues.viewAnswers,
        }),
        questionUnitDrafts: [buildQuestionUnitDraft()],
      };
      practiceRoomReadService.loadRoomContext.mockResolvedValue(roomContext);
      practiceRoomReadService.getLatestAttemptMap.mockResolvedValue(new Map());
      practiceRoomReadService.getModuleProgressSnapshot.mockResolvedValue({
        id: TEST_MODULE_ID,
      });
      practiceRoomReadService.getQuestionRewardStateMap.mockResolvedValue(
        new Map(),
      );
      practiceRoomReadService.getClaimedStreakTiers.mockResolvedValue([1, 2]);
      expStreakService.getHistoricalHighestPracticeStreak.mockResolvedValue(5);
      practiceRoomMapper.buildResponse.mockReturnValue({
        practiceRoom: {
          sessionId: roomContext.session.id,
          moduleUnitId: roomContext.moduleUnit.id,
          moduleUnitTitle: roomContext.moduleUnit.title,
          questions: [],
        },
      });

      await service.getPracticeRoom(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        undefined,
        PracticeSessionTypeValues.viewAnswers,
      );

      expect(
        expStreakService.getHistoricalHighestPracticeStreak,
      ).toHaveBeenCalledWith(TEST_MODULE_UNIT_ID, TEST_STUDENT_ID);
      expect(expStreakService.getSessionStreak).not.toHaveBeenCalled();
      expect(practiceRoomMapper.buildResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStreak: 5,
          highestStreak: 5,
        }),
      );
    });
  });

  describe('submitAttempt', () => {
    it('coordinates submission workflow and shapes the final response', async () => {
      const payload = buildSubmitAttemptPayload();
      const rewardReasons = {
        baseQuestionExp: 'awarded',
        firstAttemptBonus: 'awarded',
      };

      practiceRoomSessionService.getOwnedPracticeSessionOrThrow.mockResolvedValue(
        buildOwnedPracticeSession(),
      );
      practiceRoomAttemptService.computeIsCorrectForPayload.mockResolvedValue(
        true,
      );
      practiceRoomAttemptService.hasAnyAttempt.mockResolvedValue(false);
      practiceRoomAttemptService.hasAnySessionAttempt.mockResolvedValue(false);
      practiceRoomAttemptService.hasAnyCorrectAttempt.mockResolvedValue(false);
      studentModuleUnitProgressService.syncFromAttempts.mockResolvedValue({
        isCompleted: true,
      });
      expAwardingService.awardAttemptModuleExp.mockResolvedValue({
        updatedMembership: {
          moduleId: TEST_MODULE_ID,
          userModuleLevel: 4,
          currentExp: 180,
          module: {
            title: 'Biology',
            description: 'Study biology',
          },
        },
        moduleAwards: {
          baseQuestionExp: 33,
          firstAttemptBonus: 17,
          streakBonus: 9,
        },
      });
      expAwardingService.awardCompletionExp.mockResolvedValue(75);
      practiceRoomAttemptService.resolveSubmitAwardReasons.mockReturnValue(
        rewardReasons,
      );
      expStreakService.getSessionStreak.mockResolvedValue({
        currentStreak: 3,
        highestStreak: 5,
      });

      const result = await service.submitAttempt(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        payload,
      );

      expect(
        practiceRoomAttemptService.validateModuleUnitPayload,
      ).toHaveBeenCalledWith(TEST_MODULE_UNIT_ID, TEST_MODULE_UNIT_ID);
      expect(
        practiceRoomSessionService.assertSessionAllowsSubmissions,
      ).toHaveBeenCalledWith('practice_room');
      expect(
        practiceRoomReadService.assertModuleUnitAllowsSubmissions,
      ).toHaveBeenCalledWith(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        'practice_room',
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(
        practiceRoomAttemptService.createAttemptRecord,
      ).toHaveBeenCalledWith(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        payload,
        true,
        expect.any(Date),
        prisma,
      );
      expect(dailyPracticeFsrsStateService.applyEncounter).toHaveBeenCalledWith(
        {
          userId: TEST_STUDENT_ID,
          moduleId: TEST_MODULE_ID,
          moduleUnitId: TEST_MODULE_UNIT_ID,
          questionUnitId: payload.questionUnitId,
          reviewedAt: expect.any(Date),
          firstAttemptCorrect: true,
          hintUnlocked: false,
          timeTakenMs: payload.timeTakenMs,
        },
        prisma,
      );
      expect(
        practiceRoomSessionService.closeSessionOnCompletionIfNeeded,
      ).toHaveBeenCalledWith(TEST_SESSION_ID, expect.any(Date), true, prisma);
      expect(
        questProgressService.recordModuleUnitCompletion,
      ).toHaveBeenCalledWith(
        {
          userId: TEST_STUDENT_ID,
          moduleId: TEST_MODULE_ID,
          completedAt: expect.any(Date),
        },
        prisma,
      );
      expect(result).toEqual({
        awards: {
          baseQuestionExp: 33,
          firstAttemptBonus: 17,
          streakBonus: 9,
          masteryExp: 0,
          accountExp: 75,
        },
        awardReasons: rewardReasons,
        hasCorrectAttempt: true,
        updatedModuleProgress: {
          id: TEST_MODULE_ID,
          title: 'Biology',
          description: 'Study biology',
          userModuleLevel: 4,
          currentExp: 180,
          expMax: MODULE_UNIT_BASELINE_EXP,
        },
        currentStreak: 3,
        highestStreak: 5,
      });
    });

    it('skips completion side effects when the unit remains incomplete', async () => {
      const payload = buildSubmitAttemptPayload({ hintUnlocked: true });

      practiceRoomSessionService.getOwnedPracticeSessionOrThrow.mockResolvedValue(
        buildOwnedPracticeSession(),
      );
      practiceRoomAttemptService.computeIsCorrectForPayload.mockResolvedValue(
        false,
      );
      practiceRoomAttemptService.hasAnyAttempt.mockResolvedValue(true);
      practiceRoomAttemptService.hasAnySessionAttempt.mockResolvedValue(false);
      practiceRoomAttemptService.hasAnyCorrectAttempt.mockResolvedValue(true);
      studentModuleUnitProgressService.syncFromAttempts.mockResolvedValue({
        isCompleted: false,
      });
      expAwardingService.awardAttemptModuleExp.mockResolvedValue({
        updatedMembership: undefined,
        moduleAwards: {
          baseQuestionExp: 0,
          firstAttemptBonus: 0,
          streakBonus: 0,
        },
      });
      practiceRoomAttemptService.resolveSubmitAwardReasons.mockReturnValue({
        baseQuestionExp: 'incorrect',
        firstAttemptBonus: 'incorrect',
      });
      expStreakService.getSessionStreak.mockResolvedValue({
        currentStreak: 0,
        highestStreak: 1,
      });

      const result = await service.submitAttempt(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        payload,
      );

      expect(dailyPracticeFsrsStateService.applyEncounter).toHaveBeenCalledWith(
        {
          userId: TEST_STUDENT_ID,
          moduleId: TEST_MODULE_ID,
          moduleUnitId: TEST_MODULE_UNIT_ID,
          questionUnitId: payload.questionUnitId,
          reviewedAt: expect.any(Date),
          firstAttemptCorrect: false,
          hintUnlocked: true,
          timeTakenMs: payload.timeTakenMs,
        },
        prisma,
      );
      expect(expAwardingService.awardCompletionExp).not.toHaveBeenCalled();
      expect(
        questProgressService.recordModuleUnitCompletion,
      ).not.toHaveBeenCalled();
      expect(result.updatedModuleProgress).toBeUndefined();
    });

    it('stores retry attempts without awarding XP or mutating completion progress', async () => {
      const payload = buildSubmitAttemptPayload();

      practiceRoomSessionService.getOwnedPracticeSessionOrThrow.mockResolvedValue(
        buildOwnedPracticeSession({ sessionType: 'retry' }),
      );
      practiceRoomAttemptService.computeIsCorrectForPayload.mockResolvedValue(
        true,
      );
      practiceRoomAttemptService.hasAnyAttempt.mockResolvedValue(true);
      practiceRoomAttemptService.hasAnySessionAttempt.mockResolvedValue(false);
      practiceRoomAttemptService.hasAnyCorrectAttempt.mockResolvedValue(true);
      practiceRoomAttemptService.resolveSubmitAwardReasons.mockReturnValue({
        baseQuestionExp: 'already_earned',
        firstAttemptBonus: 'not_first_try',
      });
      expStreakService.getHistoricalHighestPracticeStreak.mockResolvedValue(5);

      const result = await service.submitAttempt(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        payload,
      );

      expect(
        practiceRoomReadService.assertModuleUnitAllowsSubmissions,
      ).toHaveBeenCalledWith(TEST_MODULE_UNIT_ID, TEST_STUDENT_ID, 'retry');
      expect(
        studentModuleUnitProgressService.syncFromAttempts,
      ).not.toHaveBeenCalled();
      expect(dailyPracticeFsrsStateService.applyEncounter).toHaveBeenCalledWith(
        {
          userId: TEST_STUDENT_ID,
          moduleId: TEST_MODULE_ID,
          moduleUnitId: TEST_MODULE_UNIT_ID,
          questionUnitId: payload.questionUnitId,
          reviewedAt: expect.any(Date),
          firstAttemptCorrect: true,
          hintUnlocked: false,
          timeTakenMs: payload.timeTakenMs,
        },
        prisma,
      );
      expect(
        practiceRoomSessionService.closeSessionOnCompletionIfNeeded,
      ).not.toHaveBeenCalled();
      expect(expAwardingService.awardAttemptModuleExp).not.toHaveBeenCalled();
      expect(expAwardingService.awardCompletionExp).not.toHaveBeenCalled();
      expect(
        questProgressService.recordModuleUnitCompletion,
      ).not.toHaveBeenCalled();
      expect(
        questProgressService.recordRetrySessionProgress,
      ).toHaveBeenCalledWith(
        {
          userId: TEST_STUDENT_ID,
          moduleId: TEST_MODULE_ID,
          moduleUnitId: TEST_MODULE_UNIT_ID,
          sessionId: TEST_SESSION_ID,
          attemptedAt: expect.any(Date),
        },
        prisma,
      );
      expect(expStreakService.getSessionStreak).not.toHaveBeenCalled();
      expect(
        expStreakService.getHistoricalHighestPracticeStreak,
      ).toHaveBeenCalledWith(TEST_MODULE_UNIT_ID, TEST_STUDENT_ID);
      expect(result).toEqual({
        awards: {
          baseQuestionExp: 0,
          firstAttemptBonus: 0,
          streakBonus: 0,
          masteryExp: 0,
          accountExp: 0,
        },
        awardReasons: {
          baseQuestionExp: 'already_earned',
          firstAttemptBonus: 'not_first_try',
        },
        hasCorrectAttempt: true,
        updatedModuleProgress: undefined,
        currentStreak: 5,
        highestStreak: 5,
      });
    });

    it('does not reapply adaptive review state after the first question attempt in the same session', async () => {
      const payload = buildSubmitAttemptPayload();

      practiceRoomSessionService.getOwnedPracticeSessionOrThrow.mockResolvedValue(
        buildOwnedPracticeSession(),
      );
      practiceRoomAttemptService.computeIsCorrectForPayload.mockResolvedValue(
        true,
      );
      practiceRoomAttemptService.hasAnyAttempt.mockResolvedValue(true);
      practiceRoomAttemptService.hasAnySessionAttempt.mockResolvedValue(true);
      practiceRoomAttemptService.hasAnyCorrectAttempt.mockResolvedValue(true);
      studentModuleUnitProgressService.syncFromAttempts.mockResolvedValue({
        isCompleted: false,
      });
      expAwardingService.awardAttemptModuleExp.mockResolvedValue({
        updatedMembership: undefined,
        moduleAwards: {
          baseQuestionExp: 0,
          firstAttemptBonus: 0,
          streakBonus: 0,
        },
      });
      practiceRoomAttemptService.resolveSubmitAwardReasons.mockReturnValue({
        baseQuestionExp: 'already_earned',
        firstAttemptBonus: 'not_first_try',
      });
      expStreakService.getSessionStreak.mockResolvedValue({
        currentStreak: 1,
        highestStreak: 2,
      });

      await service.submitAttempt(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        payload,
      );

      expect(
        dailyPracticeFsrsStateService.applyEncounter,
      ).not.toHaveBeenCalled();
    });
  });

  describe('closeSession', () => {
    it('verifies module ownership before delegating the close operation', async () => {
      practiceRoomReadService.getModuleUnitOrThrow.mockResolvedValue(
        buildLoadedModuleUnit(),
      );
      practiceRoomSessionService.closeOwnedSession.mockResolvedValue({
        sessionId: TEST_SESSION_ID,
        closedAt: '2026-03-14T10:00:00.000Z',
      });

      const result = await service.closeSession(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        TEST_SESSION_ID,
      );

      expect(practiceRoomReadService.getModuleUnitOrThrow).toHaveBeenCalledWith(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
      );
      expect(practiceRoomSessionService.closeOwnedSession).toHaveBeenCalledWith(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        TEST_SESSION_ID,
      );
      expect(result.closedAt).toBe('2026-03-14T10:00:00.000Z');
    });
  });

  describe('closeStaleSessions', () => {
    it('delegates stale-session cleanup to the lifecycle service', async () => {
      practiceRoomSessionService.closeStaleSessions.mockResolvedValue({
        closedCount: 2,
      });

      await expect(
        service.closeStaleSessions({ inactivityMinutes: 30 }),
      ).resolves.toEqual({
        closedCount: 2,
      });
      expect(
        practiceRoomSessionService.closeStaleSessions,
      ).toHaveBeenCalledWith({
        inactivityMinutes: 30,
      });
    });
  });
});
