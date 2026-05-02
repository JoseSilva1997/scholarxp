// Isolates pure lesson drilldown attempt analytics so question-health rules stay testable without Nest dependencies.
import type {
  HighHintUsageRow,
  QuestionAccuracySummary,
  QuestionVariantDiscrepancy,
  SlowQuestionRow,
} from '@scholarxp/api-contracts';
import { groupByField, median } from './roster.helpers';

export type AttemptRow = {
  id: number;
  sessionId: string;
  studentId: number | null;
  questionId: number;
  contentId: number;
  isCorrect: boolean;
  timeTakenMs: number;
  hintsUsed: number;
  attemptedAt: Date;
  question: { title: string };
  content: {
    isCore: boolean;
    questionUnitId: number;
    variantMetadata: { variantLabel: string } | null;
  };
};

const MIN_QUESTION_ATTEMPTS = 5;
const TIME_OUTLIER_CAP_MS = 180_000;
const HINT_USAGE_THRESHOLD_PCT = 40;
const SLOW_QUESTION_MULTIPLIER = 2;
const VARIANT_DISCREPANCY_THRESHOLD_PP = 15;
const MAX_STRUGGLING_QUESTIONS = 10;

// Extracts the chronologically first attempt per student from a question attempt set
// Uses attemptedAt timestamp as primary sort key; id as tiebreaker for same-millisecond attempts
function firstAttemptsByStudent(attempts: AttemptRow[]): AttemptRow[] {
  const byStudent = new Map<number, AttemptRow>();

  for (const attempt of attempts) {
    if (attempt.studentId === null) continue;

    const bestAttempt = byStudent.get(attempt.studentId);
    if (
      !bestAttempt ||
      attempt.attemptedAt < bestAttempt.attemptedAt ||
      (attempt.attemptedAt.getTime() === bestAttempt.attemptedAt.getTime() &&
        attempt.id < bestAttempt.id)
    ) {
      byStudent.set(attempt.studentId, attempt);
    }
  }

  return [...byStudent.values()];
}

// Computes accuracy percentage rounded to nearest integer
function percentageFromAttempts(attempts: AttemptRow[]): number {
  return Math.round(
    (attempts.filter((attempt) => attempt.isCorrect).length / attempts.length) *
      100,
  );
}

// Identifies questions with consistently low first-attempt accuracy
// Requires minimum attempt threshold to avoid statistical noise from rarely-encountered questions
// Returns top MAX_STRUGGLING_QUESTIONS ordered by ascending first-attempt accuracy
export function computeStrugglingQuestions(
  attempts: AttemptRow[],
): QuestionAccuracySummary[] {
  const attemptsByQuestion = groupByField(
    attempts,
    (attempt) => attempt.questionId,
  );
  const result: QuestionAccuracySummary[] = [];

  for (const [questionId, questionAttempts] of attemptsByQuestion) {
    if (questionAttempts.length < MIN_QUESTION_ATTEMPTS) continue;

    const firstAttempts = firstAttemptsByStudent(questionAttempts);
    result.push({
      questionId,
      questionTitle: questionAttempts[0].question.title,
      totalAttempts: questionAttempts.length,
      firstAttemptAccuracy:
        firstAttempts.length > 0 ? percentageFromAttempts(firstAttempts) : 0,
      overallAccuracy: percentageFromAttempts(questionAttempts),
    });
  }

  result.sort(
    (left, right) => left.firstAttemptAccuracy - right.firstAttemptAccuracy,
  );

  return result.slice(0, MAX_STRUGGLING_QUESTIONS);
}

// Detects variant questions whose difficulty differs significantly from their core question variant
// Two-pass algorithm: first establishes accuracy baselines for all core variants, then compares non-core variants
// Only reports discrepancies that meet or exceed the threshold; negative deltas indicate easier variants
export function computeVariantDiscrepancies(
  attempts: AttemptRow[],
): QuestionVariantDiscrepancy[] {
  const attemptsByContent = groupByField(
    attempts,
    (attempt) => `${attempt.questionId}:${attempt.contentId}`,
  );
  const coreAccuracyByQuestion = new Map<
    number,
    { accuracy: number; attempts: number }
  >();

  for (const contentAttempts of attemptsByContent.values()) {
    const sample = contentAttempts[0];
    if (!sample.content.isCore) continue;

    const firstAttempts = firstAttemptsByStudent(contentAttempts);
    if (firstAttempts.length < MIN_QUESTION_ATTEMPTS) continue;

    coreAccuracyByQuestion.set(sample.questionId, {
      accuracy: percentageFromAttempts(firstAttempts),
      attempts: firstAttempts.length,
    });
  }

  const result: QuestionVariantDiscrepancy[] = [];

  for (const contentAttempts of attemptsByContent.values()) {
    const sample = contentAttempts[0];
    if (sample.content.isCore || !sample.content.variantMetadata) continue;

    const coreData = coreAccuracyByQuestion.get(sample.questionId);
    if (!coreData) continue;

    const firstAttempts = firstAttemptsByStudent(contentAttempts);
    if (firstAttempts.length < MIN_QUESTION_ATTEMPTS) continue;

    const variantAccuracy = percentageFromAttempts(firstAttempts);
    const delta = variantAccuracy - coreData.accuracy;

    if (Math.abs(delta) >= VARIANT_DISCREPANCY_THRESHOLD_PP) {
      result.push({
        questionId: sample.questionId,
        questionTitle: contentAttempts[0].question.title,
        coreAccuracy: coreData.accuracy,
        coreAttempts: coreData.attempts,
        variantLabel: sample.content.variantMetadata.variantLabel,
        variantAccuracy,
        variantAttempts: firstAttempts.length,
        delta,
      });
    }
  }

  return result;
}

// Flags questions where a high proportion of first-attempt solvers relied on hints
// Indicates questions may benefit from wording clarification or scaffolding improvement
// Returned in descending order of hint usage rate
export function computeHighHintUsage(
  attempts: AttemptRow[],
): HighHintUsageRow[] {
  const attemptsByQuestion = groupByField(
    attempts,
    (attempt) => attempt.questionId,
  );
  const result: HighHintUsageRow[] = [];

  for (const [questionId, questionAttempts] of attemptsByQuestion) {
    if (questionAttempts.length < MIN_QUESTION_ATTEMPTS) continue;

    const firstAttempts = firstAttemptsByStudent(questionAttempts);
    const totalStudents = firstAttempts.length;
    if (totalStudents === 0) continue;

    const studentsWithHint = firstAttempts.filter(
      (attempt) => attempt.hintsUsed > 0,
    ).length;
    const hintUsageRate = Math.round((studentsWithHint / totalStudents) * 100);

    if (hintUsageRate >= HINT_USAGE_THRESHOLD_PCT) {
      result.push({
        questionId,
        questionTitle: questionAttempts[0].question.title,
        hintUsageRate,
        studentsWithHint,
        totalStudents,
      });
    }
  }

  result.sort((left, right) => right.hintUsageRate - left.hintUsageRate);
  return result;
}

// Identifies questions that consume disproportionate time relative to lesson baseline
// Algorithm: caps extreme outliers (180s+) to reduce skew, identifies session-opening attempts (excluded
// as they may include navigation/context switching overhead), computes per-question medians, then flags
// questions exceeding 2x the lesson median time. Returned in descending order of median time.
export function computeSlowQuestions(
  attempts: AttemptRow[],
): SlowQuestionRow[] {
  const cappedAttempts = attempts.filter(
    (attempt) => attempt.timeTakenMs <= TIME_OUTLIER_CAP_MS,
  );

  const attemptsBySession = groupByField(
    cappedAttempts,
    (attempt) => `${attempt.sessionId}:${attempt.studentId ?? 'null'}`,
  );
  // Identify the first attempt chronologically in each session—often includes navigation overhead
  const sessionOpeners = new Set<number>();

  for (const sessionAttempts of attemptsBySession.values()) {
    sessionAttempts.sort((left, right) => {
      if (left.attemptedAt < right.attemptedAt) return -1;
      if (left.attemptedAt > right.attemptedAt) return 1;
      return left.id - right.id;
    });
    sessionOpeners.add(sessionAttempts[0].id);
  }

  // Exclude session openers and compute per-question time distributions
  const qualifyingAttempts = cappedAttempts.filter(
    (attempt) => !sessionOpeners.has(attempt.id),
  );
  const attemptsByQuestion = groupByField(
    qualifyingAttempts,
    (attempt) => attempt.questionId,
  );
  const questionMedians: {
    questionId: number;
    medianMs: number;
    title: string;
    count: number;
  }[] = [];

  for (const [questionId, questionAttempts] of attemptsByQuestion) {
    if (questionAttempts.length < MIN_QUESTION_ATTEMPTS) continue;

    questionMedians.push({
      questionId,
      medianMs: median(questionAttempts.map((attempt) => attempt.timeTakenMs)),
      title: questionAttempts[0].question.title,
      count: questionAttempts.length,
    });
  }

  if (questionMedians.length === 0) return [];

  // Compute lesson-level baseline as median of all question medians
  const lessonMedianMs = median(
    questionMedians.map((question) => question.medianMs),
  );
  const result: SlowQuestionRow[] = [];

  // Flag questions exceeding 2x baseline; normalizes for lesson difficulty differences
  for (const question of questionMedians) {
    if (question.medianMs > SLOW_QUESTION_MULTIPLIER * lessonMedianMs) {
      result.push({
        questionId: question.questionId,
        questionTitle: question.title,
        medianTimeSec: Math.round(question.medianMs / 100) / 10,
        lessonMedianTimeSec: Math.round(lessonMedianMs / 100) / 10,
        qualifyingAttempts: question.count,
      });
    }
  }

  result.sort((left, right) => right.medianTimeSec - left.medianTimeSec);
  return result;
}
