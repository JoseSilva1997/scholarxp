// Role: verifies that mapper methods produce correctly shaped DTOs and handle all date/null edge cases.
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DailyPracticeSelectionBucketValues,
  PracticeSessionTypeValues,
} from '@scholarxp/api-contracts';
import { DailyPracticeMapper } from './daily-practice.mapper';

const PRACTICE_DATE = new Date('2026-03-22T00:00:00.000Z');
const COMPLETED_AT = new Date('2026-03-22T14:30:00.000Z');

describe('DailyPracticeMapper', () => {
  let mapper: DailyPracticeMapper;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [DailyPracticeMapper],
    }).compile();

    mapper = moduleRef.get(DailyPracticeMapper);
  });

  // ── buildTodayResponse ─────────────────────────────────────────────────────

  describe('buildTodayResponse', () => {
    it('maps top-level set fields onto the response DTO', () => {
      const result = mapper.buildTodayResponse(buildTodayInput());

      expect(result.setId).toBe('set-1');
      expect(result.moduleId).toBe(7);
      expect(result.practiceDateUtc).toBe('2026-03-22T00:00:00.000Z');
      expect(result.sessionId).toBe('session-uuid');
      expect(result.sessionType).toBe(PracticeSessionTypeValues.dailyPractice);
      expect(result.algorithmVersion).toBe('fsrs_v1');
    });

    it('maps progress fields and converts completedAt Date to ISO string', () => {
      const result = mapper.buildTodayResponse(
        buildTodayInput({
          progress: {
            totalQuestions: 5,
            answeredQuestions: 3,
            completedAt: COMPLETED_AT,
          },
        }),
      );

      expect(result.progress.totalQuestions).toBe(5);
      expect(result.progress.answeredQuestions).toBe(3);
      expect(result.progress.completedAt).toBe('2026-03-22T14:30:00.000Z');
    });

    it('sets progress.completedAt to null when the set is not yet complete', () => {
      const result = mapper.buildTodayResponse(buildTodayInput());

      expect(result.progress.completedAt).toBeNull();
    });

    it('maps each question item in order', () => {
      const result = mapper.buildTodayResponse(buildTodayInput());

      expect(result.questions).toHaveLength(1);
      const q = result.questions[0];
      expect(q.questionUnitId).toBe(10);
      expect(q.moduleUnitId).toBe(1);
      expect(q.moduleUnitTitle).toBe('Lesson A');
      expect(q.position).toBe(0);
      expect(q.hasCorrectAttempt).toBe(null);
      expect(q.sourceBucket).toBe(DailyPracticeSelectionBucketValues.dueReview);
    });

    it('maps core question content fields', () => {
      const result = mapper.buildTodayResponse(buildTodayInput());
      const cq = result.questions[0].coreQuestion;

      expect(cq.questionId).toBe(10);
      expect(cq.questionContent.id).toBe(1001);
      expect(cq.questionContent.type).toBe('multiple_choice');
      expect(cq.questionContent.questionStem).toBe('What is 2+2?');
      expect(cq.questionContent.hint).toBe('Think small.');
    });

    it('maps lastAttempt when present', () => {
      const input = buildTodayInput({
        lastAttempt: {
          studentAnswer: { selectedOptionId: 2 },
          isCorrect: true,
        },
      });

      const result = mapper.buildTodayResponse(input);

      expect(result.questions[0].coreQuestion.lastAttempt).toEqual({
        studentAnswer: { selectedOptionId: 2 },
        isCorrect: true,
      });
    });

    it('sets lastAttempt to null when no attempt exists', () => {
      const result = mapper.buildTodayResponse(buildTodayInput());

      expect(result.questions[0].coreQuestion.lastAttempt).toBeNull();
    });

    it('returns a DailyPracticeTodayResponseDto instance', () => {
      const { DailyPracticeTodayResponseDto } = jest.requireActual(
        './dto/daily-practice-response.dto',
      );
      const result = mapper.buildTodayResponse(buildTodayInput());

      expect(result).toBeInstanceOf(DailyPracticeTodayResponseDto);
    });
  });

  // ── buildSubmitResponse ────────────────────────────────────────────────────

  describe('buildSubmitResponse', () => {
    it('maps awards, hasCorrectAttempt, progress, and encounterGrade', () => {
      const result = mapper.buildSubmitResponse({
        awards: { xp: 10, streakBonus: 0 } as any,
        hasCorrectAttempt: true,
        progress: {
          totalQuestions: 5,
          answeredQuestions: 2,
          completedAt: null,
        },
        encounterGrade: 'good',
      });

      expect(result.awards).toEqual({ xp: 10, streakBonus: 0 });
      expect(result.hasCorrectAttempt).toBe(true);
      expect(result.progress.totalQuestions).toBe(5);
      expect(result.progress.answeredQuestions).toBe(2);
      expect(result.progress.completedAt).toBeNull();
      expect(result.encounterGrade).toBe('good');
    });

    it('converts completedAt Date to ISO string when the set is finished', () => {
      const result = mapper.buildSubmitResponse({
        awards: {} as any,
        hasCorrectAttempt: false,
        progress: {
          totalQuestions: 5,
          answeredQuestions: 5,
          completedAt: COMPLETED_AT,
        },
        encounterGrade: 'again',
      });

      expect(result.progress.completedAt).toBe('2026-03-22T14:30:00.000Z');
    });
  });

  // ── buildCloseResponse ─────────────────────────────────────────────────────

  describe('buildCloseResponse', () => {
    it('maps sessionId, closedAt, progress, and setCompleted false when not complete', () => {
      const result = mapper.buildCloseResponse({
        sessionId: 'session-uuid',
        closedAt: '2026-03-22T15:00:00.000Z',
        progress: {
          totalQuestions: 5,
          answeredQuestions: 2,
          completedAt: null,
        },
      });

      expect(result.sessionId).toBe('session-uuid');
      expect(result.closedAt).toBe('2026-03-22T15:00:00.000Z');
      expect(result.progress.totalQuestions).toBe(5);
      expect(result.progress.answeredQuestions).toBe(2);
      expect(result.progress.completedAt).toBeNull();
      expect(result.setCompleted).toBe(false);
    });

    it('sets setCompleted true when completedAt is not null', () => {
      const result = mapper.buildCloseResponse({
        sessionId: 'session-uuid',
        closedAt: '2026-03-22T15:00:00.000Z',
        progress: {
          totalQuestions: 5,
          answeredQuestions: 5,
          completedAt: COMPLETED_AT,
        },
      });

      expect(result.setCompleted).toBe(true);
      expect(result.progress.completedAt).toBe('2026-03-22T14:30:00.000Z');
    });
  });
});

// ── Builder ────────────────────────────────────────────────────────────────

function buildTodayInput(
  overrides: {
    progress?: {
      totalQuestions: number;
      answeredQuestions: number;
      completedAt: Date | null;
    };
    lastAttempt?: { studentAnswer: unknown; isCorrect: boolean } | null;
  } = {},
) {
  return {
    setId: 'set-1',
    moduleId: 7,
    practiceDateUtc: PRACTICE_DATE,
    sessionId: 'session-uuid',
    sessionType: PracticeSessionTypeValues.dailyPractice,
    algorithmVersion: 'fsrs_v1',
    progress: overrides.progress ?? {
      totalQuestions: 5,
      answeredQuestions: 0,
      completedAt: null,
    },
    questions: [
      {
        questionUnitId: 10,
        moduleUnitId: 1,
        moduleUnitTitle: 'Lesson A',
        position: 0,
        hasCorrectAttempt: null,
        sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
        coreQuestion: {
          questionId: 10,
          questionContent: {
            id: 1001,
            type: 'multiple_choice',
            questionStem: 'What is 2+2?',
            questionData: { options: [] } as any,
            hint: 'Think small.',
          },
          lastAttempt: overrides.lastAttempt ?? null,
        },
      },
    ],
  };
}
