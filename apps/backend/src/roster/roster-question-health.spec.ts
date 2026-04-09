// Locks question-health thresholds so lesson drilldown analytics keep flagging the same student pain points.
import {
  computeSlowQuestions,
  computeVariantDiscrepancies,
  type AttemptRow,
} from './roster-question-health';

const NOW = new Date('2026-03-28T12:00:00.000Z');

function makeAttempt(
  overrides: Partial<AttemptRow> = {},
  contentOverrides: Partial<AttemptRow['content']> = {},
): AttemptRow {
  return {
    id: 1,
    sessionId: 'session-1',
    studentId: 1,
    questionId: 100,
    contentId: 200,
    isCorrect: true,
    timeTakenMs: 10_000,
    hintsUsed: 0,
    attemptedAt: NOW,
    question: { title: 'Q100' },
    content: {
      isCore: true,
      questionUnitId: 100,
      variantMetadata: null,
      ...contentOverrides,
    },
    ...overrides,
  };
}

describe('roster-question-health', () => {
  describe('computeVariantDiscrepancies', () => {
    it('does not flag a variant when the accuracy gap stays below 15 percentage points', () => {
      const coreAttempts = Array.from({ length: 5 }, (_, index) =>
        makeAttempt({
          id: index + 1,
          studentId: index + 1,
          isCorrect: index < 4,
        }),
      );
      const variantAttempts = Array.from({ length: 5 }, (_, index) =>
        makeAttempt(
          {
            id: index + 10,
            studentId: index + 6,
            contentId: 201,
            isCorrect: index < 4,
          },
          {
            isCore: false,
            variantMetadata: { variantLabel: 'Harder' },
          },
        ),
      );

      expect(
        computeVariantDiscrepancies([...coreAttempts, ...variantAttempts]),
      ).toEqual([]);
    });
  });

  describe('computeSlowQuestions', () => {
    it('drops the session opener for each student before computing slow questions', () => {
      const start = new Date('2026-03-28T10:00:00.000Z');
      const later = new Date('2026-03-28T10:01:00.000Z');
      const attempts = Array.from({ length: 5 }, (_, index) => {
        const studentId = index + 1;
        const sessionId = `session-${studentId}`;

        return [
          makeAttempt({
            id: studentId * 10,
            studentId,
            sessionId,
            attemptedAt: start,
            questionId: 100,
            contentId: 200,
            timeTakenMs: 2_000,
          }),
          makeAttempt({
            id: studentId * 10 + 1,
            studentId,
            sessionId,
            attemptedAt: later,
            questionId: 101,
            contentId: 201,
            timeTakenMs: 2_000,
            question: { title: 'Q101' },
          }),
        ];
      }).flat();

      expect(computeSlowQuestions(attempts)).toEqual([]);
    });
  });
});
