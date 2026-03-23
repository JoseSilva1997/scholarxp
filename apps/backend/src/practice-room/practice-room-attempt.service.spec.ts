/* Test role: verifies PracticeRoomAttemptService owns grading, validation,
 and attempt persistence after the facade refactor extracted submit details.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import { PracticeRoomAttemptService } from './practice-room-attempt.service';
import {
  buildSubmitAttemptPayload,
  TEST_MODULE_UNIT_ID,
  TEST_QUESTION_CONTENT_ID,
  TEST_QUESTION_UNIT_ID,
  TEST_SESSION_ID,
  TEST_STUDENT_ID,
} from './practice-room.test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';

describe('PracticeRoomAttemptService', () => {
  let service: PracticeRoomAttemptService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeRoomAttemptService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PracticeRoomAttemptService>(
      PracticeRoomAttemptService,
    );
  });

  describe('validateModuleUnitPayload', () => {
    it('throws when the route and payload moduleUnitIds diverge', () => {
      expect(() =>
        service.validateModuleUnitPayload(TEST_MODULE_UNIT_ID, 11),
      ).toThrow(BadRequestException);
    });
  });

  describe('computeIsCorrectForPayload', () => {
    it('grades mcq answers against persisted correctOptionIndex data', async () => {
      prisma.questionContent.findFirst.mockResolvedValue({
        id: TEST_QUESTION_UNIT_ID,
        type: 'mcq',
        questionData: { correctOptionIndex: 1 },
      } as never);

      await expect(
        service.computeIsCorrectForPayload(
          TEST_MODULE_UNIT_ID,
          TEST_QUESTION_UNIT_ID,
          TEST_QUESTION_CONTENT_ID,
          {
            selectedOptionIndex: 1,
          },
        ),
      ).resolves.toBe(true);
    });

    it('grades true-false answers against stored boolean flags', async () => {
      prisma.questionContent.findFirst.mockResolvedValue({
        id: TEST_QUESTION_UNIT_ID,
        type: 'true-false',
        questionData: {
          trueOption: { isCorrect: false },
          falseOption: { isCorrect: true },
        },
      } as never);

      await expect(
        service.computeIsCorrectForPayload(
          TEST_MODULE_UNIT_ID,
          TEST_QUESTION_UNIT_ID,
          TEST_QUESTION_CONTENT_ID,
          {
            selectedOptionIndex: 1,
          },
        ),
      ).resolves.toBe(true);
    });

    it('throws a safe error for invalid submitted answer formats', async () => {
      prisma.questionContent.findFirst.mockResolvedValue({
        id: TEST_QUESTION_UNIT_ID,
        type: 'mcq',
        questionData: { correctOptionIndex: 1 },
      } as never);

      await expect(
        service.computeIsCorrectForPayload(
          TEST_MODULE_UNIT_ID,
          TEST_QUESTION_UNIT_ID,
          TEST_QUESTION_CONTENT_ID,
          {
            data: { unsupported: true },
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when the canonical question content is missing', async () => {
      prisma.questionContent.findFirst.mockResolvedValue(null);

      await expect(
        service.computeIsCorrectForPayload(
          TEST_MODULE_UNIT_ID,
          TEST_QUESTION_UNIT_ID,
          TEST_QUESTION_CONTENT_ID,
          {
            selectedOptionIndex: 0,
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('keeps regular practice-room core-only by querying only isCore content by default', async () => {
      prisma.questionContent.findFirst.mockResolvedValue({
        id: TEST_QUESTION_CONTENT_ID,
        type: 'mcq',
        questionData: { correctOptionIndex: 1 },
      } as never);

      await service.computeIsCorrectForPayload(
        TEST_MODULE_UNIT_ID,
        TEST_QUESTION_UNIT_ID,
        TEST_QUESTION_CONTENT_ID,
        {
          selectedOptionIndex: 1,
        },
      );

      expect(prisma.questionContent.findFirst).toHaveBeenCalledWith({
        where: {
          id: TEST_QUESTION_CONTENT_ID,
          questionUnitId: TEST_QUESTION_UNIT_ID,
          isArchived: false,
          isCore: true,
          questionUnit: {
            is: {
              id: TEST_QUESTION_UNIT_ID,
              moduleUnitId: TEST_MODULE_UNIT_ID,
              isArchived: false,
            },
          },
        },
        select: {
          id: true,
          type: true,
          questionData: true,
        },
      });
    });

    it('allows daily practice to grade variant content when explicitly requested', async () => {
      prisma.questionContent.findFirst.mockResolvedValue({
        id: TEST_QUESTION_CONTENT_ID,
        type: 'mcq',
        questionData: { correctOptionIndex: 1 },
      } as never);

      await service.computeIsCorrectForPayload(
        TEST_MODULE_UNIT_ID,
        TEST_QUESTION_UNIT_ID,
        TEST_QUESTION_CONTENT_ID,
        {
          selectedOptionIndex: 1,
        },
        { allowVariantContent: true },
      );

      expect(prisma.questionContent.findFirst).toHaveBeenCalledWith({
        where: {
          id: TEST_QUESTION_CONTENT_ID,
          questionUnitId: TEST_QUESTION_UNIT_ID,
          isArchived: false,
          questionUnit: {
            is: {
              id: TEST_QUESTION_UNIT_ID,
              moduleUnitId: TEST_MODULE_UNIT_ID,
              isArchived: false,
            },
          },
        },
        select: {
          id: true,
          type: true,
          questionData: true,
        },
      });
    });
  });

  describe('resolveSubmitAwardReasons', () => {
    it('marks the first-attempt bonus as hint_used for hinted first correct answers', () => {
      expect(
        service.resolveSubmitAwardReasons({
          isCorrect: true,
          hadAnyAttemptBeforeSubmit: false,
          hintUnlockedOnSubmit: true,
          moduleAwards: {
            baseQuestionExp: 10,
            firstAttemptBonus: 0,
          },
        }),
      ).toEqual({
        baseQuestionExp: 'awarded',
        firstAttemptBonus: 'hint_used',
      });
    });
  });

  describe('attempt history queries', () => {
    it('returns booleans for prior attempt lookups without leaking row data', async () => {
      prisma.questionAttempt.findFirst
        .mockResolvedValueOnce({ id: 1 } as never)
        .mockResolvedValueOnce(null);

      await expect(
        service.hasAnyAttempt(
          TEST_MODULE_UNIT_ID,
          TEST_STUDENT_ID,
          TEST_QUESTION_UNIT_ID,
        ),
      ).resolves.toBe(true);
      await expect(
        service.hasAnyCorrectAttempt(
          TEST_MODULE_UNIT_ID,
          TEST_STUDENT_ID,
          TEST_QUESTION_UNIT_ID,
        ),
      ).resolves.toBe(false);

      expect(prisma.questionAttempt.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          moduleUnitId: TEST_MODULE_UNIT_ID,
          studentId: TEST_STUDENT_ID,
          questionId: TEST_QUESTION_UNIT_ID,
          session: {
            sessionType: PracticeSessionTypeValues.practiceRoom,
          },
        },
        select: { id: true },
      });
      expect(prisma.questionAttempt.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          moduleUnitId: TEST_MODULE_UNIT_ID,
          studentId: TEST_STUDENT_ID,
          questionId: TEST_QUESTION_UNIT_ID,
          isCorrect: true,
          session: {
            sessionType: PracticeSessionTypeValues.practiceRoom,
          },
        },
        select: { id: true },
      });
    });
  });

  describe('createAttemptRecord', () => {
    it('persists the normalized attempt shape used by downstream rewards', async () => {
      const payload = buildSubmitAttemptPayload({
        hintUnlocked: true,
      });
      const attemptedAt = new Date('2026-03-14T12:00:00.000Z');
      prisma.questionAttempt.create.mockResolvedValue({ id: 1 } as never);

      await service.createAttemptRecord(
        TEST_MODULE_UNIT_ID,
        TEST_STUDENT_ID,
        payload,
        true,
        attemptedAt,
      );

      expect(prisma.questionAttempt.create).toHaveBeenCalledWith({
        data: {
          moduleUnitId: TEST_MODULE_UNIT_ID,
          studentId: TEST_STUDENT_ID,
          questionId: TEST_QUESTION_UNIT_ID,
          contentId: TEST_QUESTION_CONTENT_ID,
          sessionId: TEST_SESSION_ID,
          isCorrect: true,
          timeTakenMs: 1500,
          hintsUsed: 1,
          studentAnswer: { selectedOptionIndex: 1 },
          attemptedAt,
        },
        select: { id: true },
      });
    });
  });
});
