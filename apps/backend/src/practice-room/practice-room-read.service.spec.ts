/* Test role: verifies PracticeRoomReadService owns read-model assembly and
 lookup policy after extraction from the facade service.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GlobalRole, ModuleUnitStatus } from '@prisma/client';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import { MODULE_UNIT_BASELINE_EXP } from '@scholarxp/constants';
import { PracticeRoomMapper } from './practice-room.mapper';
import { PracticeRoomReadService } from './practice-room-read.service';
import { PracticeRoomSessionService } from './practice-session.service';
import {
  buildLoadedModuleUnit,
  buildOwnedPracticeSession,
  buildQuestionUnitDraft,
  TEST_MODULE_ID,
  TEST_MODULE_UNIT_ID,
  TEST_QUESTION_CONTENT_ID,
  TEST_QUESTION_UNIT_ID,
  TEST_STUDENT_ID,
} from './practice-room.test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';

describe('PracticeRoomReadService', () => {
  let service: PracticeRoomReadService;
  let prisma: PrismaMock;
  let practiceRoomMapper: {
    toQuestionUnitDrafts: jest.Mock;
    toLatestAttemptMap: jest.Mock;
  };
  let practiceRoomSessionService: {
    resolveOwnedSessionByType: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    practiceRoomMapper = {
      toQuestionUnitDrafts: jest.fn(),
      toLatestAttemptMap: jest.fn(),
    };
    practiceRoomSessionService = {
      resolveOwnedSessionByType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeRoomReadService,
        { provide: PrismaService, useValue: prisma },
        { provide: PracticeRoomMapper, useValue: practiceRoomMapper },
        {
          provide: PracticeRoomSessionService,
          useValue: practiceRoomSessionService,
        },
      ],
    }).compile();

    service = module.get<PracticeRoomReadService>(PracticeRoomReadService);
  });

  describe('loadRoomContext', () => {
    it('loads module state and drafts through the extracted collaborators', async () => {
      const moduleUnit = buildLoadedModuleUnit();
      const drafts = [buildQuestionUnitDraft()];
      const session = buildOwnedPracticeSession();

      prisma.moduleUnit.findFirst.mockResolvedValue(moduleUnit as never);
      prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
        isCompleted: false,
      } as never);
      practiceRoomSessionService.resolveOwnedSessionByType.mockResolvedValue(
        session,
      );
      practiceRoomMapper.toQuestionUnitDrafts.mockReturnValue(drafts);

      const result = await service.loadRoomContext(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
      );

      expect(
        practiceRoomSessionService.resolveOwnedSessionByType,
      ).toHaveBeenCalledWith(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.practiceRoom,
        undefined,
      );
      expect(practiceRoomMapper.toQuestionUnitDrafts).toHaveBeenCalledWith(
        moduleUnit,
      );
      expect(result).toEqual({
        moduleUnit,
        isReadOnly: false,
        session,
        questionUnitDrafts: drafts,
      });
    });

    it('opens completed lessons in retry mode when explicitly requested', async () => {
      const moduleUnit = buildLoadedModuleUnit();
      const drafts = [buildQuestionUnitDraft()];
      const session = buildOwnedPracticeSession({
        sessionType: PracticeSessionTypeValues.retry,
      });

      prisma.moduleUnit.findFirst.mockResolvedValue(moduleUnit as never);
      prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
        isCompleted: true,
      } as never);
      practiceRoomSessionService.resolveOwnedSessionByType.mockResolvedValue(
        session,
      );
      practiceRoomMapper.toQuestionUnitDrafts.mockReturnValue(drafts);

      const result = await service.loadRoomContext(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.retry,
      );

      expect(
        practiceRoomSessionService.resolveOwnedSessionByType,
      ).toHaveBeenCalledWith(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.retry,
        undefined,
      );
      expect(result.isReadOnly).toBe(false);
      expect(result.session.sessionType).toBe(PracticeSessionTypeValues.retry);
    });

    it('ignores stale session ids that belong to a different room mode after completion', async () => {
      const moduleUnit = buildLoadedModuleUnit();
      const drafts = [buildQuestionUnitDraft()];
      const viewAnswersSession = buildOwnedPracticeSession({
        id: '22222222-2222-4222-8222-222222222222',
        sessionType: PracticeSessionTypeValues.viewAnswers,
      });

      prisma.moduleUnit.findFirst.mockResolvedValue(moduleUnit as never);
      prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
        isCompleted: true,
      } as never);
      practiceRoomSessionService.resolveOwnedSessionByType
        .mockRejectedValueOnce(
          new ForbiddenException(
            'This session does not belong to the requested practice flow.',
          ),
        )
        .mockResolvedValueOnce(viewAnswersSession);
      practiceRoomMapper.toQuestionUnitDrafts.mockReturnValue(drafts);

      const result = await service.loadRoomContext(
        TEST_MODULE_ID,
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        undefined,
        '11111111-1111-4111-8111-111111111111',
      );

      expect(
        practiceRoomSessionService.resolveOwnedSessionByType,
      ).toHaveBeenNthCalledWith(
        1,
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.viewAnswers,
        '11111111-1111-4111-8111-111111111111',
      );
      expect(
        practiceRoomSessionService.resolveOwnedSessionByType,
      ).toHaveBeenNthCalledWith(
        2,
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.viewAnswers,
      );
      expect(result.isReadOnly).toBe(true);
      expect(result.session).toBe(viewAnswersSession);
    });
  });

  describe('getModuleUnitOrThrow', () => {
    it('throws when the module unit is missing for the module scope', async () => {
      prisma.moduleUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.getModuleUnitOrThrow(TEST_MODULE_ID, TEST_MODULE_UNIT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('restricts the lookup to live units for student callers', async () => {
      prisma.moduleUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.getModuleUnitOrThrow(
          TEST_MODULE_ID,
          TEST_MODULE_UNIT_ID,
          GlobalRole.student,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.moduleUnit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: TEST_MODULE_UNIT_ID,
            moduleId: TEST_MODULE_ID,
            status: ModuleUnitStatus.live,
          }),
        }),
      );
    });

    it('does not constrain status for non-student callers', async () => {
      prisma.moduleUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.getModuleUnitOrThrow(
          TEST_MODULE_ID,
          TEST_MODULE_UNIT_ID,
          GlobalRole.teacher,
        ),
      ).rejects.toThrow(NotFoundException);
      const callArg = prisma.moduleUnit.findFirst.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('status');
    });
  });

  describe('getLatestAttempts', () => {
    it('returns an empty list when there are no eligible draft ids to query', async () => {
      const result = await service.getLatestAttempts(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        [],
      );

      expect(result).toEqual([]);
      expect(prisma.questionAttempt.findMany).not.toHaveBeenCalled();
    });

    it('queries and maps the latest attempts for the provided draft ids', async () => {
      const drafts = [
        buildQuestionUnitDraft(),
        buildQuestionUnitDraft({
          questionUnitId: TEST_QUESTION_UNIT_ID + 1,
          coreContentId: TEST_QUESTION_CONTENT_ID + 1,
        }),
      ];
      prisma.questionAttempt.findMany.mockResolvedValue([
        {
          questionId: TEST_QUESTION_UNIT_ID,
          contentId: TEST_QUESTION_CONTENT_ID,
          studentAnswer: { selectedOptionIndex: 1 },
          isCorrect: true,
          attemptedAt: new Date('2026-03-14T10:00:00.000Z'),
        },
      ] as never);

      const result = await service.getLatestAttempts(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        drafts,
      );

      expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
        where: {
          moduleUnitId: TEST_MODULE_UNIT_ID,
          studentId: TEST_STUDENT_ID,
          questionId: {
            in: [TEST_QUESTION_UNIT_ID, TEST_QUESTION_UNIT_ID + 1],
          },
          contentId: {
            in: [TEST_QUESTION_CONTENT_ID, TEST_QUESTION_CONTENT_ID + 1],
          },
        },
        orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
        select: {
          questionId: true,
          contentId: true,
          studentAnswer: true,
          isCorrect: true,
          attemptedAt: true,
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.questionId).toBe(TEST_QUESTION_UNIT_ID);
    });

    it('scopes retry latest-attempt reads to the active retry session', async () => {
      const drafts = [buildQuestionUnitDraft()];
      prisma.questionAttempt.findMany.mockResolvedValue([] as never);

      await service.getLatestAttempts(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        drafts,
        '11111111-1111-4111-8111-111111111222',
        PracticeSessionTypeValues.retry,
      );

      expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
        where: {
          moduleUnitId: TEST_MODULE_UNIT_ID,
          studentId: TEST_STUDENT_ID,
          sessionId: '11111111-1111-4111-8111-111111111222',
          questionId: {
            in: [TEST_QUESTION_UNIT_ID],
          },
          contentId: {
            in: [TEST_QUESTION_CONTENT_ID],
          },
        },
        orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
        select: {
          questionId: true,
          contentId: true,
          studentAnswer: true,
          isCorrect: true,
          attemptedAt: true,
        },
      });
    });

    it('loads historical lesson attempts for viewAnswers so correct answers remain visible', async () => {
      const drafts = [buildQuestionUnitDraft()];
      prisma.questionAttempt.findMany.mockResolvedValue([] as never);

      await service.getLatestAttempts(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        drafts,
        '11111111-1111-4111-8111-111111111333',
        PracticeSessionTypeValues.viewAnswers,
      );

      expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
        where: {
          moduleUnitId: TEST_MODULE_UNIT_ID,
          studentId: TEST_STUDENT_ID,
          session: { sessionType: PracticeSessionTypeValues.practiceRoom },
          questionId: { in: [TEST_QUESTION_UNIT_ID] },
          contentId: { in: [TEST_QUESTION_CONTENT_ID] },
        },
        orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
        select: {
          questionId: true,
          contentId: true,
          studentAnswer: true,
          isCorrect: true,
          attemptedAt: true,
        },
      });
    });

    it('scopes practiceRoom latest-attempt reads by sessionType to exclude daily-practice attempts', async () => {
      const drafts = [buildQuestionUnitDraft()];
      prisma.questionAttempt.findMany.mockResolvedValue([] as never);

      await service.getLatestAttempts(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        drafts,
        '11111111-1111-4111-8111-111111111444',
        PracticeSessionTypeValues.practiceRoom,
      );

      expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
        where: {
          moduleUnitId: TEST_MODULE_UNIT_ID,
          studentId: TEST_STUDENT_ID,
          session: { sessionType: PracticeSessionTypeValues.practiceRoom },
          questionId: { in: [TEST_QUESTION_UNIT_ID] },
          contentId: { in: [TEST_QUESTION_CONTENT_ID] },
        },
        orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
        select: {
          questionId: true,
          contentId: true,
          studentAnswer: true,
          isCorrect: true,
          attemptedAt: true,
        },
      });
    });
  });

  describe('getModuleProgressSnapshot', () => {
    it('returns the shared module summary shape for an enrolled student', async () => {
      prisma.userModule.findUnique.mockResolvedValue({
        moduleId: TEST_MODULE_ID,
        userModuleLevel: 3,
        currentExp: 55,
        module: {
          title: 'Biology',
          description: 'Study biology',
        },
      } as never);

      await expect(
        service.getModuleProgressSnapshot(TEST_MODULE_ID, TEST_STUDENT_ID),
      ).resolves.toEqual({
        id: TEST_MODULE_ID,
        title: 'Biology',
        description: 'Study biology',
        userModuleLevel: 3,
        currentExp: 55,
        expMax: MODULE_UNIT_BASELINE_EXP,
      });
    });
  });

  describe('getQuestionRewardStateMap', () => {
    it('builds deterministic reward state from ordered attempt history', async () => {
      prisma.questionAttempt.findMany.mockResolvedValue([
        {
          questionId: TEST_QUESTION_UNIT_ID,
          isCorrect: false,
          hintsUsed: 1,
        },
        {
          questionId: TEST_QUESTION_UNIT_ID,
          isCorrect: true,
          hintsUsed: 0,
        },
      ] as never);

      const result = await service.getQuestionRewardStateMap(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        [buildQuestionUnitDraft()],
      );

      expect(result.get(TEST_QUESTION_UNIT_ID)).toEqual({
        baseQuestionExpStatus: 'already_earned',
        firstAttemptBonusStatus: 'lost',
      });
      expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
        where: {
          moduleUnitId: TEST_MODULE_UNIT_ID,
          studentId: TEST_STUDENT_ID,
          questionId: { in: [TEST_QUESTION_UNIT_ID] },
          session: {
            sessionType: PracticeSessionTypeValues.practiceRoom,
          },
        },
        orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
        select: {
          questionId: true,
          isCorrect: true,
          hintsUsed: true,
        },
      });
    });
  });

  describe('getClaimedStreakTiers', () => {
    it('extracts, deduplicates, and sorts claimed tiers from ledger keys', async () => {
      prisma.expLedger.findMany.mockResolvedValue([
        { idempotencyKey: 'practice-room:tier:3' },
        { idempotencyKey: 'practice-room:tier:1' },
        { idempotencyKey: 'practice-room:tier:3' },
        { idempotencyKey: 'practice-room:ignore-me' },
      ] as never);

      await expect(
        service.getClaimedStreakTiers(
          TEST_MODULE_ID,
          TEST_MODULE_UNIT_ID,
          TEST_STUDENT_ID,
        ),
      ).resolves.toEqual([1, 3]);
    });
  });

  describe('assertModuleUnitAllowsSubmissions', () => {
    it('throws when persisted progress marks the unit complete', async () => {
      prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
        isCompleted: true,
      } as never);

      await expect(
        service.assertModuleUnitAllowsSubmissions(
          TEST_MODULE_UNIT_ID,
          TEST_STUDENT_ID,
          PracticeSessionTypeValues.practiceRoom,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows completed lessons to accept retry submissions', async () => {
      prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
        isCompleted: true,
      } as never);

      await expect(
        service.assertModuleUnitAllowsSubmissions(
          TEST_MODULE_UNIT_ID,
          TEST_STUDENT_ID,
          PracticeSessionTypeValues.retry,
        ),
      ).resolves.toBeUndefined();
    });

    it('blocks student submissions when the unit is not live', async () => {
      prisma.moduleUnit.findUnique.mockResolvedValue({
        status: ModuleUnitStatus.draft,
      } as never);

      await expect(
        service.assertModuleUnitAllowsSubmissions(
          TEST_MODULE_UNIT_ID,
          TEST_STUDENT_ID,
          PracticeSessionTypeValues.practiceRoom,
          GlobalRole.student,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets non-students submit against draft units', async () => {
      prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
        isCompleted: false,
      } as never);

      await expect(
        service.assertModuleUnitAllowsSubmissions(
          TEST_MODULE_UNIT_ID,
          TEST_STUDENT_ID,
          PracticeSessionTypeValues.practiceRoom,
          GlobalRole.teacher,
        ),
      ).resolves.toBeUndefined();
      expect(prisma.moduleUnit.findUnique).not.toHaveBeenCalled();
    });
  });
});
