import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { parseArgs } from 'util';
import { DailyPracticeFsrsPolicyService } from '../daily-practice/daily-practice-fsrs-policy.service';
import { buildDailyPracticeSelectionPlan } from '../daily-practice/daily-practice-set-sizing.policy';
import type { StudentQuestionStateRecord } from '../daily-practice/daily-practice.types';

type Grade = 'good' | 'hard' | 'again';

type QuestionState = {
  label: string;
  lesson: number;
  question: number;
  dueAt: Date;
  stability: number;
  difficulty: number;
  reviewCount: number;
  lapseCount: number;
  lastGrade: Grade;
  lastSeenAt: Date;
  lastReviewedAt: Date;
};

type Candidate = {
  state: QuestionState;
  sourceBucket: 'due_review' | 'reinforcement';
  selectionScore: number;
  originalIndex?: number;
};

type SimulationConfig = {
  questionsPerLesson: number;
  wrongPerLesson: number;
  dailyPracticeWrongPerWeek: number;
  lessonWeeks: number;
  totalWeeks: number;
  output: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENT_STRUGGLE_WINDOW_DAYS = 14;
const MAX_QUESTIONS_PER_LESSON = 3;
const AGAIN_DUE_REVIEW_PRIORITY_BOOST_MS = 21 * MS_PER_DAY;
const HARD_DUE_REVIEW_PRIORITY_BOOST_MS = 7 * MS_PER_DAY;
const LAPSE_DUE_REVIEW_PRIORITY_BOOST_MS = 3 * MS_PER_DAY;
const timezone = 'UTC';

function parseConfig(): SimulationConfig {
  const { values } = parseArgs({
    options: {
      questionsPerLesson: { type: 'string' },
      wrongPerLesson: { type: 'string' },
      dailyPracticeWrongPerWeek: { type: 'string' },
      lessonWeeks: { type: 'string' },
      totalWeeks: { type: 'string' },
      output: { type: 'string' },
    },
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
  });

  return {
    questionsPerLesson: parsePositiveInt(values.questionsPerLesson, 10),
    wrongPerLesson: parseNonNegativeInt(values.wrongPerLesson, 2),
    dailyPracticeWrongPerWeek: parseNonNegativeInt(
      values.dailyPracticeWrongPerWeek,
      0,
    ),
    lessonWeeks: parsePositiveInt(values.lessonWeeks, 12),
    totalWeeks: parsePositiveInt(values.totalWeeks, 16),
    output: values.output ?? null,
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}".`);
  }

  return parsed;
}

function parseNonNegativeInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer, received "${value}".`);
  }

  return parsed;
}

function validateConfig(config: SimulationConfig): void {
  if (config.wrongPerLesson > config.questionsPerLesson) {
    throw new Error('--wrongPerLesson cannot exceed --questionsPerLesson.');
  }

  if (config.lessonWeeks > config.totalWeeks) {
    throw new Error('--lessonWeeks cannot exceed --totalWeeks.');
  }
}

function runSimulation(config: SimulationConfig): string {
  validateConfig(config);

  const policy = new DailyPracticeFsrsPolicyService();
  const states: QuestionState[] = [];
  const weeksWithDailyPracticeWrong = new Set<number>();
  const rows: string[] = [
    'day_number,week,day_in_week,question_count,questions,wrong_first_attempt_questions,wrong_daily_practice_questions',
  ];
  const start = new Date('2026-01-05T00:00:00.000Z');

  function dayStart(dayNumber: number): Date {
    return new Date(start.getTime() + (dayNumber - 1) * MS_PER_DAY);
  }

  function addLesson(lesson: number, reviewedAt: Date): string[] {
    const wrongQuestions: string[] = [];
    const firstWrongQuestion =
      config.questionsPerLesson - config.wrongPerLesson + 1;

    for (
      let question = 1;
      question <= config.questionsPerLesson;
      question += 1
    ) {
      const wasWrongFirstInLesson = question >= firstWrongQuestion;
      const label = `L${lesson}Q${question}`;
      if (wasWrongFirstInLesson) {
        wrongQuestions.push(label);
      }

      const grade: Grade = wasWrongFirstInLesson ? 'hard' : 'good';
      const evidence = {
        priorFailedAttempts: wasWrongFirstInLesson ? 1 : 0,
        priorHintedAttempts: 0,
        timeToFirstCorrectMs: wasWrongFirstInLesson ? 20_000 : 10_000,
      };
      const seed = policy.computeSeedStateForFirstCorrect({
        grade,
        reviewedAt,
        timezone,
        evidence,
      });

      states.push({
        label,
        lesson,
        question,
        dueAt: seed.dueAt,
        stability: seed.stability,
        difficulty: seed.difficulty,
        reviewCount: seed.reps,
        lapseCount: seed.lapses,
        lastGrade: grade,
        lastSeenAt: reviewedAt,
        lastReviewedAt: reviewedAt,
      });
    }

    return wrongQuestions;
  }

  function buildDueCandidates(now: Date): Candidate[] {
    return states
      .filter((state) => state.dueAt.getTime() <= now.getTime())
      .map((state) => ({
        state,
        sourceBucket: 'due_review' as const,
        selectionScore:
          now.getTime() -
          state.dueAt.getTime() +
          dueReviewPriorityBoost(state, now),
      }))
      .sort(compareDueCandidates);
  }

  function buildReinforcementCandidates(now: Date): Candidate[] {
    return states
      .filter((state) => {
        if (state.dueAt.getTime() <= now.getTime()) {
          return false;
        }

        const recent =
          now.getTime() - state.lastSeenAt.getTime() <=
          RECENT_STRUGGLE_WINDOW_DAYS * MS_PER_DAY;

        return (
          recent && (state.lastGrade === 'again' || state.lastGrade === 'hard')
        );
      })
      .map((state) => ({
        state,
        sourceBucket: 'reinforcement' as const,
        selectionScore: reinforcementScore(state, now),
      }))
      .sort(compareReinforcementCandidates);
  }

  function compareDueCandidates(left: Candidate, right: Candidate): number {
    return (
      right.selectionScore - left.selectionScore ||
      left.state.lesson - right.state.lesson ||
      left.state.question - right.state.question
    );
  }

  function compareReinforcementCandidates(
    left: Candidate,
    right: Candidate,
  ): number {
    return (
      right.selectionScore - left.selectionScore ||
      left.state.lesson - right.state.lesson ||
      left.state.question - right.state.question
    );
  }

  function reinforcementScore(state: QuestionState, now: Date): number {
    const recencyMs = now.getTime() - state.lastSeenAt.getTime();
    const gradePenalty =
      state.lastGrade === 'again' ? 3 : state.lastGrade === 'hard' ? 2 : 1;
    const recencyScore = Math.max(
      0,
      RECENT_STRUGGLE_WINDOW_DAYS * MS_PER_DAY - recencyMs,
    );

    return (
      gradePenalty * 1_000_000_000 + state.lapseCount * 1_000_000 + recencyScore
    );
  }

  function dueReviewPriorityBoost(state: QuestionState, now: Date): number {
    const gradeBoost = isRecentStruggle(state, now)
      ? state.lastGrade === 'again'
        ? AGAIN_DUE_REVIEW_PRIORITY_BOOST_MS
        : HARD_DUE_REVIEW_PRIORITY_BOOST_MS
      : 0;

    return gradeBoost + state.lapseCount * LAPSE_DUE_REVIEW_PRIORITY_BOOST_MS;
  }

  function isRecentStruggle(state: QuestionState, now: Date): boolean {
    const recent =
      now.getTime() - state.lastSeenAt.getTime() <=
      RECENT_STRUGGLE_WINDOW_DAYS * MS_PER_DAY;

    return (
      recent && (state.lastGrade === 'again' || state.lastGrade === 'hard')
    );
  }

  function selectFromBucket(
    bucket: Candidate[],
    count: number,
    selectedLabels: Set<string>,
    lessonCounts: Map<number, number>,
  ): Candidate[] {
    const selected: Candidate[] = [];

    for (const candidate of bucket) {
      if (selected.length >= count) {
        break;
      }

      if (selectedLabels.has(candidate.state.label)) {
        continue;
      }

      const lessonCount = lessonCounts.get(candidate.state.lesson) ?? 0;
      if (lessonCount >= MAX_QUESTIONS_PER_LESSON) {
        continue;
      }

      accept(candidate, selected, selectedLabels, lessonCounts);
    }

    for (const candidate of bucket) {
      if (selected.length >= count) {
        break;
      }

      if (selectedLabels.has(candidate.state.label)) {
        continue;
      }

      accept(candidate, selected, selectedLabels, lessonCounts);
    }

    return selected;
  }

  function accept(
    candidate: Candidate,
    selected: Candidate[],
    selectedLabels: Set<string>,
    lessonCounts: Map<number, number>,
  ): void {
    selected.push(candidate);
    selectedLabels.add(candidate.state.label);
    lessonCounts.set(
      candidate.state.lesson,
      (lessonCounts.get(candidate.state.lesson) ?? 0) + 1,
    );
  }

  function orderSelectedQuestions(selected: Candidate[]): Candidate[] {
    const queues = Array.from(
      selected.reduce((map, candidate, originalIndex) => {
        const queue = map.get(candidate.state.lesson) ?? [];
        queue.push({ ...candidate, originalIndex });
        map.set(candidate.state.lesson, queue);
        return map;
      }, new Map<number, Candidate[]>()),
    ).sort(([left], [right]) => left - right);

    const ordered: Candidate[] = [];
    let previousLesson: number | null = null;

    while (queues.some(([, queue]) => queue.length > 0)) {
      const nonEmpty = queues.filter(([, queue]) => queue.length > 0);
      const eligible = nonEmpty.filter(([lesson]) => lesson !== previousLesson);
      const pool = eligible.length > 0 ? eligible : nonEmpty;
      const [lesson, queue] = pool.sort((left, right) => {
        return (
          right[1].length - left[1].length ||
          (left[1][0].originalIndex ?? 0) - (right[1][0].originalIndex ?? 0) ||
          left[0] - right[0]
        );
      })[0];
      const next = queue.shift();

      if (next) {
        ordered.push(next);
        previousLesson = lesson;
      }
    }

    return ordered;
  }

  function selectDailyPractice(now: Date): Candidate[] {
    const due = buildDueCandidates(now);
    const reinforcement = buildReinforcementCandidates(now);
    const plan = buildDailyPracticeSelectionPlan({
      dueReviewCount: due.length,
      reinforcementCount: reinforcement.length,
    });

    if (plan.targetQuestionCount === 0) {
      return [];
    }

    const selectedLabels = new Set<string>();
    const lessonCounts = new Map<number, number>();
    const selected = [
      ...selectFromBucket(
        due,
        plan.dueReviewQuota,
        selectedLabels,
        lessonCounts,
      ),
      ...selectFromBucket(
        reinforcement,
        plan.reinforcementQuota,
        selectedLabels,
        lessonCounts,
      ),
    ];

    const dueShortfall =
      plan.dueReviewQuota -
      selected.filter((candidate) => candidate.sourceBucket === 'due_review')
        .length;
    if (dueShortfall > 0) {
      selected.push(
        ...selectFromBucket(
          reinforcement,
          dueShortfall,
          selectedLabels,
          lessonCounts,
        ),
      );
    }

    const remaining = plan.targetQuestionCount - selected.length;
    if (remaining > 0) {
      selected.push(
        ...selectFromBucket(due, remaining, selectedLabels, lessonCounts),
      );
    }

    const stillRemaining = plan.targetQuestionCount - selected.length;
    if (stillRemaining > 0) {
      selected.push(
        ...selectFromBucket(
          reinforcement,
          stillRemaining,
          selectedLabels,
          lessonCounts,
        ),
      );
    }

    return orderSelectedQuestions(selected);
  }

  function applyDailyPracticeEncounter(
    candidate: Candidate,
    reviewedAt: Date,
    grade: Grade,
  ): void {
    const state = candidate.state;
    const existingState: StudentQuestionStateRecord = {
      id: '0',
      userId: 1,
      moduleId: 1,
      moduleUnitId: state.lesson,
      questionUnitId: state.lesson * 100 + state.question,
      fsrsState: 'review',
      fsrsDifficulty: state.difficulty,
      fsrsStability: state.stability,
      fsrsDueAt: state.dueAt,
      fsrsLastReviewedAt: state.lastReviewedAt,
      reviewCount: state.reviewCount,
      lapseCount: state.lapseCount,
      lastGrade: state.lastGrade,
      lastSeenAt: state.lastSeenAt,
      lastCorrectAt: state.lastSeenAt,
      recentAvgTimeMs: 10_000,
      firstSeenAt: state.lastSeenAt,
      algorithmVersion: 'fsrs_v1',
    };
    const next = policy.computeNextStateForExisting({
      existingState,
      grade,
      reviewedAt,
      timezone,
    });

    state.dueAt = next.dueAt;
    state.stability = next.stability;
    state.difficulty = next.difficulty;
    state.reviewCount = next.reps;
    state.lapseCount = next.lapses;
    state.lastGrade = grade;
    state.lastSeenAt = reviewedAt;
    state.lastReviewedAt = reviewedAt;
  }

  for (let dayNumber = 1; dayNumber <= config.totalWeeks * 7; dayNumber += 1) {
    const week = Math.ceil(dayNumber / 7);
    const dayInWeek = ((dayNumber - 1) % 7) + 1;
    const now = dayStart(dayNumber);
    const selected = selectDailyPractice(now);
    const wrongDailyPracticeQuestions =
      selected.length > 0 &&
      config.dailyPracticeWrongPerWeek > 0 &&
      !weeksWithDailyPracticeWrong.has(week)
        ? selected
            .slice(0, config.dailyPracticeWrongPerWeek)
            .map((candidate) => candidate.state.label)
        : [];

    if (wrongDailyPracticeQuestions.length > 0) {
      weeksWithDailyPracticeWrong.add(week);
    }

    for (const candidate of selected) {
      applyDailyPracticeEncounter(
        candidate,
        now,
        wrongDailyPracticeQuestions.includes(candidate.state.label)
          ? 'again'
          : 'good',
      );
    }

    const wrongQuestions =
      dayInWeek === 1 && week <= config.lessonWeeks ? addLesson(week, now) : [];

    rows.push(
      [
        dayNumber,
        week,
        dayInWeek,
        selected.length,
        quoteCsv(selected.map((candidate) => candidate.state.label).join('; ')),
        quoteCsv(wrongQuestions.join('; ')),
        quoteCsv(wrongDailyPracticeQuestions.join('; ')),
      ].join(','),
    );
  }

  return `${rows.join('\n')}\n`;
}

function quoteCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const config = parseConfig();
const csv = runSimulation(config);

if (config.output) {
  writeFileSync(resolve(process.cwd(), config.output), csv);
} else {
  process.stdout.write(csv);
}
