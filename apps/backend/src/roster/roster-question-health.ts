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

function percentageFromAttempts(attempts: AttemptRow[]): number {
  return Math.round(
    (attempts.filter((attempt) => attempt.isCorrect).length / attempts.length) *
      100,
  );
}

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
  const sessionOpeners = new Set<number>();

  for (const sessionAttempts of attemptsBySession.values()) {
    sessionAttempts.sort((left, right) => {
      if (left.attemptedAt < right.attemptedAt) return -1;
      if (left.attemptedAt > right.attemptedAt) return 1;
      return left.id - right.id;
    });
    sessionOpeners.add(sessionAttempts[0].id);
  }

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

  const lessonMedianMs = median(
    questionMedians.map((question) => question.medianMs),
  );
  const result: SlowQuestionRow[] = [];

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
