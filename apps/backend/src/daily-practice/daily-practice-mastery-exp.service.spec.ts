// Spec role: verifies mastery XP stage evaluation, per-question budget math, and idempotent award behavior.
import { Test, TestingModule } from '@nestjs/testing';
import { FsrsCardStateValues } from '@scholarxp/api-contracts';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleService } from '../db-entities/user-module/user-module.service';
import { ExpQuestionContextService } from '../exp-engine/exp-question-context.service';
import { MASTERY_EXP_CONFIG } from './daily-practice-mastery-exp.config';
import { DailyPracticeMasteryExpService } from './daily-practice-mastery-exp.service';
import type { StudentQuestionStateRecord } from './daily-practice.types';

const TEST_USER_ID = 100;
const TEST_MODULE_ID = 10;
const TEST_MODULE_UNIT_ID = 20;
const TEST_QUESTION_UNIT_ID = 30;
const TEST_SESSION_ID = 'session-uuid';

function buildState(
  overrides: Partial<StudentQuestionStateRecord> = {},
): StudentQuestionStateRecord {
  return {
    id: 'state-uuid',
    userId: TEST_USER_ID,
    moduleId: TEST_MODULE_ID,
    moduleUnitId: TEST_MODULE_UNIT_ID,
    questionUnitId: TEST_QUESTION_UNIT_ID,
    fsrsState: FsrsCardStateValues.learning,
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
    ...overrides,
  };
}

function buildParams(stateOverrides: Partial<StudentQuestionStateRecord> = {}) {
  return {
    userId: TEST_USER_ID,
    moduleId: TEST_MODULE_ID,
    moduleUnitId: TEST_MODULE_UNIT_ID,
    questionUnitId: TEST_QUESTION_UNIT_ID,
    sessionId: TEST_SESSION_ID,
    updatedState: buildState(stateOverrides),
  };
}

describe('DailyPracticeMasteryExpService', () => {
  let service: DailyPracticeMasteryExpService;
  let expLedgerService: { recordEvent: jest.Mock };
  let userModuleService: { addStudentModuleExp: jest.Mock };
  let expQuestionContextService: { getPracticeQuestionContext: jest.Mock };

  beforeEach(async () => {
    expLedgerService = {
      recordEvent: jest
        .fn()
        .mockImplementation((params: { awardedExp: number }) =>
          Promise.resolve({ created: true, awardedExp: params.awardedExp }),
        ),
    };
    userModuleService = {
      addStudentModuleExp: jest.fn().mockResolvedValue({ id: 1 }),
    };
    expQuestionContextService = {
      getPracticeQuestionContext: jest.fn().mockResolvedValue({
        totalQuestions: 10,
        lastQuestionId: 39,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeMasteryExpService,
        { provide: ExpLedgerService, useValue: expLedgerService },
        { provide: UserModuleService, useValue: userModuleService },
        { provide: ExpQuestionContextService, useValue: expQuestionContextService },
      ],
    }).compile();

    service = module.get(DailyPracticeMasteryExpService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('evaluateAndAward', () => {
    it('awards encountered stage on first FSRS encounter (learning state)', async () => {
      const params = buildParams({ fsrsState: FsrsCardStateValues.learning });
      const result = await service.evaluateAndAward(params);

      // Only encountered stage should fire (learning state, low stability).
      expect(result.masteryExpAwarded).toBeGreaterThan(0);
      expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(1);
      expect(expLedgerService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED,
          userId: TEST_USER_ID,
          moduleUnitId: TEST_MODULE_UNIT_ID,
        }),
        undefined,
      );
    });

    it('awards encountered + graduated when state is review', async () => {
      const params = buildParams({
        fsrsState: FsrsCardStateValues.review,
        fsrsStability: 3.0,
      });
      const result = await service.evaluateAndAward(params);

      // Encountered + graduated should fire (review state, but stability < 7).
      expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(2);
      const eventTypes = expLedgerService.recordEvent.mock.calls.map(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType,
      );
      expect(eventTypes).toContain(ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED);
      expect(eventTypes).toContain(ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_GRADUATED);
      expect(result.masteryExpAwarded).toBeGreaterThan(0);
    });

    it('awards all three stages when state is review with high stability', async () => {
      const params = buildParams({
        fsrsState: FsrsCardStateValues.review,
        fsrsStability: 10.0,
      });
      const result = await service.evaluateAndAward(params);

      expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(3);
      const eventTypes = expLedgerService.recordEvent.mock.calls.map(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType,
      );
      expect(eventTypes).toContain(ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED);
      expect(eventTypes).toContain(ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_GRADUATED);
      expect(eventTypes).toContain(ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED);
      expect(result.masteryExpAwarded).toBeGreaterThan(0);
    });

    it('does not award graduated when state is relearning', async () => {
      const params = buildParams({
        fsrsState: FsrsCardStateValues.relearning,
        fsrsStability: 2.0,
      });
      await service.evaluateAndAward(params);

      // Only encountered should fire.
      expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(1);
      expect(expLedgerService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED,
        }),
        undefined,
      );
    });

    it('does not award retained when stability is below threshold', async () => {
      const params = buildParams({
        fsrsState: FsrsCardStateValues.review,
        fsrsStability: MASTERY_EXP_CONFIG.RETAINED_STABILITY_THRESHOLD - 0.1,
      });
      await service.evaluateAndAward(params);

      const eventTypes = expLedgerService.recordEvent.mock.calls.map(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType,
      );
      expect(eventTypes).not.toContain(ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED);
    });

    it('awards retained when stability equals threshold exactly', async () => {
      const params = buildParams({
        fsrsState: FsrsCardStateValues.review,
        fsrsStability: MASTERY_EXP_CONFIG.RETAINED_STABILITY_THRESHOLD,
      });
      await service.evaluateAndAward(params);

      const eventTypes = expLedgerService.recordEvent.mock.calls.map(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType,
      );
      expect(eventTypes).toContain(ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED);
    });

    it('returns 0 when idempotency prevents duplicate awards', async () => {
      expLedgerService.recordEvent.mockResolvedValue({
        created: false,
        awardedExp: 0,
      });
      const params = buildParams({
        fsrsState: FsrsCardStateValues.review,
        fsrsStability: 10.0,
      });

      const result = await service.evaluateAndAward(params);

      expect(result.masteryExpAwarded).toBe(0);
      // Ledger was called but no module XP should be added.
      expect(userModuleService.addStudentModuleExp).not.toHaveBeenCalled();
    });

    it('returns 0 when question context has zero eligible questions', async () => {
      expQuestionContextService.getPracticeQuestionContext.mockResolvedValue({
        totalQuestions: 0,
        lastQuestionId: null,
      });
      const params = buildParams({
        fsrsState: FsrsCardStateValues.review,
        fsrsStability: 10.0,
      });

      const result = await service.evaluateAndAward(params);

      expect(result.masteryExpAwarded).toBe(0);
      expect(expLedgerService.recordEvent).not.toHaveBeenCalled();
    });

    it('calls addStudentModuleExp for each newly created ledger event', async () => {
      const params = buildParams({
        fsrsState: FsrsCardStateValues.review,
        fsrsStability: 10.0,
      });

      await service.evaluateAndAward(params);

      // All three stages should trigger module XP updates.
      expect(userModuleService.addStudentModuleExp).toHaveBeenCalledTimes(3);
    });

    it('uses correct idempotency key format', async () => {
      const params = buildParams({ fsrsState: FsrsCardStateValues.learning });
      await service.evaluateAndAward(params);

      expect(expLedgerService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: `mastery_encountered:user:${TEST_USER_ID}:unit:${TEST_MODULE_UNIT_ID}:question:${TEST_QUESTION_UNIT_ID}`,
        }),
        undefined,
      );
    });
  });

  describe('computeStageAward', () => {
    it('distributes pool evenly across questions', () => {
      // encountered pool = floor(0.15 * 700) = 105, per question = floor(105 / 10) = 10
      const award = service.computeStageAward('encountered', 10, false);
      expect(award).toBe(10);
    });

    it('gives remainder to last question', () => {
      // encountered pool = 105, base per question = 10, remainder = 105 - 10*10 = 5
      const award = service.computeStageAward('encountered', 10, true);
      expect(award).toBe(15);
    });

    it('handles single-question unit', () => {
      // encountered pool = 105, single question gets entire pool.
      const award = service.computeStageAward('encountered', 1, true);
      expect(award).toBe(105);
    });

    it('computes graduated stage pool correctly', () => {
      // graduated pool = floor(0.50 * 700) = 350, per question = floor(350 / 10) = 35
      const award = service.computeStageAward('graduated', 10, false);
      expect(award).toBe(35);
    });

    it('computes retained stage pool correctly', () => {
      // retained pool = floor(0.35 * 700) = 245, per question = floor(245 / 10) = 24
      const award = service.computeStageAward('retained', 10, false);
      expect(award).toBe(24);
    });

    it('remainder for retained stage goes to last question', () => {
      // retained pool = 245, base = 24, remainder = 245 - 24*10 = 5
      const award = service.computeStageAward('retained', 10, true);
      expect(award).toBe(29);
    });

    it('all stages for 10 questions sum to total pool', () => {
      // Verify that 10 questions × per-question awards (including remainder) = TOTAL_POOL
      let total = 0;
      for (const stage of ['encountered', 'graduated', 'retained'] as const) {
        total += service.computeStageAward(stage, 10, false) * 9;
        total += service.computeStageAward(stage, 10, true);
      }
      expect(total).toBe(MASTERY_EXP_CONFIG.TOTAL_POOL);
    });

    it('all stages for 20 questions sum to total pool', () => {
      let total = 0;
      for (const stage of ['encountered', 'graduated', 'retained'] as const) {
        total += service.computeStageAward(stage, 20, false) * 19;
        total += service.computeStageAward(stage, 20, true);
      }
      expect(total).toBe(MASTERY_EXP_CONFIG.TOTAL_POOL);
    });

    it('all stages for 1 question sum to total pool', () => {
      let total = 0;
      for (const stage of ['encountered', 'graduated', 'retained'] as const) {
        total += service.computeStageAward(stage, 1, true);
      }
      expect(total).toBe(MASTERY_EXP_CONFIG.TOTAL_POOL);
    });
  });
});
