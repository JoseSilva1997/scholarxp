// Unit tests for RosterService: covers all five public methods plus edge cases for empty modules, missing progress, and at-risk derivation.
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createPrismaMock, PrismaMock } from '../test/test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeService } from '../daily-practice/daily-practice.service';
import { RosterService } from './roster.service';

// Stable "now" so assertions are deterministic
const NOW = new Date('2026-03-28T12:00:00.000Z');
const _DAY_START = new Date('2026-03-28T00:00:00.000Z');
const THREE_DAYS_AGO = new Date('2026-03-25T12:00:00.000Z');
const EIGHT_DAYS_AGO = new Date('2026-03-20T12:00:00.000Z');

const MODULE_ID = 1;

function makeEnrollment(
  userId: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: userId * 100,
    moduleId: MODULE_ID,
    userId,
    roleInModule: 'student',
    userModuleLevel: 1,
    currentExp: 50,
    enrolledVia: 'invite',
    createdAt: EIGHT_DAYS_AGO,
    user: {
      id: userId,
      firstName: `First${userId}`,
      lastName: `Last${userId}`,
      profilePictureUrl: `avatar${userId}.png`,
    },
    ...overrides,
  } as any;
}

describe('RosterService', () => {
  let service: RosterService;
  let prisma: PrismaMock;
  let dailyPracticeService: { getDailyPracticeStatus: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    dailyPracticeService = {
      getDailyPracticeStatus: jest.fn().mockResolvedValue({ status: 'locked' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RosterService,
        { provide: PrismaService, useValue: prisma },
        { provide: DailyPracticeService, useValue: dailyPracticeService },
      ],
    }).compile();

    service = module.get(RosterService);

    // Fix Date.now so daysAgo() is deterministic
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  // ───── getSummary ─────

  describe('getSummary', () => {
    it('returns zeroed summary for module with no students', async () => {
      prisma.module.findUnique.mockResolvedValue({
        id: MODULE_ID,
        title: 'Test Module',
      } as any);
      prisma.moduleUnit.findMany.mockResolvedValue([
        { id: 10, moduleId: MODULE_ID, status: 'live' },
      ] as any);
      prisma.userModule.findMany.mockResolvedValue([] as any);

      const result = await service.getSummary(MODULE_ID);

      expect(result.studentsEnrolled).toBe(0);
      expect(result.activeLast7Days).toBe(0);
      expect(result.atRiskCount).toBe(0);
      expect(result.lessonCoverage.totalLiveLessons).toBe(1);
      expect(result.lessonCoverage.lessonsStartedByAtLeastOneStudent).toBe(0);
    });

    it('returns zeroed summary for module with no live lessons', async () => {
      prisma.module.findUnique.mockResolvedValue({
        id: MODULE_ID,
        title: 'Test Module',
      } as any);
      prisma.moduleUnit.findMany.mockResolvedValue([] as any);
      prisma.userModule.findMany.mockResolvedValue([{ userId: 1 }] as any);

      const result = await service.getSummary(MODULE_ID);

      expect(result.studentsEnrolled).toBe(1);
      expect(result.lessonCoverage.totalLiveLessons).toBe(0);
      expect(result.activeLast7Days).toBe(0);
    });

    it('throws NotFoundException when module does not exist', async () => {
      prisma.module.findUnique.mockResolvedValue(null);

      await expect(service.getSummary(999)).rejects.toThrow(NotFoundException);
    });

    it('computes active, at-risk, and backlog for a populated module', async () => {
      prisma.module.findUnique.mockResolvedValue({
        id: MODULE_ID,
        title: 'Algebra',
      } as any);
      prisma.moduleUnit.findMany.mockResolvedValue([
        { id: 10 },
        { id: 11 },
      ] as any);
      // Two enrolled students
      prisma.userModule.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ] as any);

      // Student 1 active in last 7 days, student 2 not
      prisma.questionAttempt.findMany.mockResolvedValue([
        { studentId: 1 },
      ] as any);

      // Lesson coverage: lesson 10 started, lesson 11 started and completed
      prisma.moduleUnitUserProgress.findMany
        .mockResolvedValueOnce([
          { moduleUnitId: 10 },
          { moduleUnitId: 11 },
        ] as any) // started
        .mockResolvedValueOnce([{ moduleUnitId: 11 }] as any); // completed

      // Review backlog: 3 overdue items for student 2
      prisma.studentQuestionState.findMany
        .mockResolvedValueOnce([
          { userId: 2 },
          { userId: 2 },
          { userId: 2 },
        ] as any) // backlog
        .mockResolvedValueOnce([{ userId: 2 }] as any); // overdue student ids (distinct)

      const result = await service.getSummary(MODULE_ID);

      expect(result.moduleTitle).toBe('Algebra');
      expect(result.studentsEnrolled).toBe(2);
      expect(result.activeLast7Days).toBe(1);
      // Student 2 is inactive + has overdue reviews = at risk
      // Student 1 is active and no overdue reviews = not at risk
      // But: inactive student count is 1 (student 2), overdue count is 1 (student 2), union = 1
      expect(result.atRiskCount).toBe(1);
      expect(result.lessonCoverage).toEqual({
        totalLiveLessons: 2,
        lessonsStartedByAtLeastOneStudent: 2,
        lessonsCompletedByAtLeastOneStudent: 1,
      });
      expect(result.reviewBacklog).toEqual({
        studentsWithOverdueReviews: 1,
        totalOverdueReviews: 3,
      });
    });
  });

  // ───── getStudents ─────

  describe('getStudents', () => {
    it('returns empty rows when no students enrolled', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([] as any);
      prisma.userModule.findMany.mockResolvedValue([] as any);

      const result = await service.getStudents(MODULE_ID, {});

      expect(result.rows).toEqual([]);
    });

    it('builds correct student row with all computed fields', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([
        { id: 10 },
        { id: 11 },
      ] as any);
      prisma.userModule.findMany.mockResolvedValue([makeEnrollment(1)] as any);

      // Lesson progress: lesson 10 completed, lesson 11 not started
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([
        { studentId: 1, moduleUnitId: 10, isCompleted: true },
      ] as any);

      // Ledger: lesson 10 has full baseline exp + full mastery exp → lessonMastery = 1.0
      // Lesson 11 has no entries → 0. averageMastery = (1.0 + 0) / 2 * 100 = 50
      prisma.expLedger.groupBy.mockResolvedValue([
        {
          userId: 1,
          moduleUnitId: 10,
          eventType: 'practice_room_answer_correct',
          _sum: { awardedExp: 1000 },
        },
        {
          userId: 1,
          moduleUnitId: 10,
          eventType: 'daily_practice_mastery_retained',
          _sum: { awardedExp: 700 },
        },
      ] as any);

      // Review counts: 2 due, 1 overdue
      prisma.studentQuestionState.findMany.mockResolvedValue([
        { userId: 1, fsrsDueAt: EIGHT_DAYS_AGO }, // overdue
        {
          userId: 1,
          fsrsDueAt: THREE_DAYS_AGO, // due but not overdue (within today's boundary — actually this is before DAY_START so it IS overdue)
        },
      ] as any);

      // Last activity: 3 days ago (active)
      prisma.questionAttempt.groupBy.mockResolvedValue([
        { studentId: 1, _max: { attemptedAt: THREE_DAYS_AGO } },
      ] as any);

      dailyPracticeService.getDailyPracticeStatus.mockResolvedValue({
        status: 'available',
      });

      const result = await service.getStudents(MODULE_ID, {});

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row.studentId).toBe(1);
      expect(row.fullName).toBe('First1 Last1');
      expect(row.completedLessons).toBe(1);
      expect(row.totalLiveLessons).toBe(2);
      expect(row.averageMastery).toBe(50);
      expect(row.dailyPracticeStatus).toBe('available');
      expect(row.dueReviewCount).toBe(2);
      // Both dates are before DAY_START (2026-03-28 00:00), so both overdue
      expect(row.overdueReviewCount).toBe(2);
      expect(row.enrolledVia).toBe('invite');
    });

    it('marks student as at-risk when inactive 7+ days', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([{ id: 10 }] as any);
      prisma.userModule.findMany.mockResolvedValue([makeEnrollment(1)] as any);
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([] as any);
      prisma.expLedger.groupBy.mockResolvedValue([] as any);
      prisma.studentQuestionState.findMany.mockResolvedValue([] as any);
      // No activity at all
      prisma.questionAttempt.groupBy.mockResolvedValue([] as any);

      const result = await service.getStudents(MODULE_ID, {});

      expect(result.rows[0].isAtRisk).toBe(true);
      expect(result.rows[0].lastActivityAt).toBeNull();
    });

    it('marks student as at-risk when they have overdue reviews even if active', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([{ id: 10 }] as any);
      prisma.userModule.findMany.mockResolvedValue([makeEnrollment(1)] as any);
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([] as any);
      prisma.expLedger.groupBy.mockResolvedValue([] as any);
      // Overdue review
      prisma.studentQuestionState.findMany.mockResolvedValue([
        { userId: 1, fsrsDueAt: EIGHT_DAYS_AGO },
      ] as any);
      // Active recently
      prisma.questionAttempt.groupBy.mockResolvedValue([
        { studentId: 1, _max: { attemptedAt: THREE_DAYS_AGO } },
      ] as any);

      const result = await service.getStudents(MODULE_ID, {});

      expect(result.rows[0].isAtRisk).toBe(true);
    });

    it('filters by at_risk', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([{ id: 10 }] as any);
      prisma.userModule.findMany.mockResolvedValue([
        makeEnrollment(1),
        makeEnrollment(2),
      ] as any);
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([] as any);
      prisma.expLedger.groupBy.mockResolvedValue([] as any);
      prisma.studentQuestionState.findMany.mockResolvedValue([] as any);
      // Student 1 active, student 2 inactive
      prisma.questionAttempt.groupBy.mockResolvedValue([
        { studentId: 1, _max: { attemptedAt: THREE_DAYS_AGO } },
      ] as any);

      const result = await service.getStudents(MODULE_ID, {
        filter: 'at_risk',
      });

      // Student 2 has no activity → at risk; Student 1 is active with no overdue → not at risk
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].studentId).toBe(2);
    });

    it('filters by daily_practice_locked', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([{ id: 10 }] as any);
      prisma.userModule.findMany.mockResolvedValue([
        makeEnrollment(1),
        makeEnrollment(2),
      ] as any);
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([] as any);
      prisma.expLedger.groupBy.mockResolvedValue([] as any);
      prisma.studentQuestionState.findMany.mockResolvedValue([] as any);
      prisma.questionAttempt.groupBy.mockResolvedValue([] as any);

      dailyPracticeService.getDailyPracticeStatus
        .mockResolvedValueOnce({ status: 'locked' })
        .mockResolvedValueOnce({ status: 'available' });

      const result = await service.getStudents(MODULE_ID, {
        filter: 'daily_practice_locked',
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].studentId).toBe(1);
    });

    it('sorts by name ascending', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([{ id: 10 }] as any);
      prisma.expLedger.groupBy.mockResolvedValue([] as any);
      prisma.userModule.findMany.mockResolvedValue([
        makeEnrollment(2, {
          user: {
            id: 2,
            firstName: 'Zara',
            lastName: 'Zoe',
            profilePictureUrl: 'z.png',
          },
        }),
        makeEnrollment(1, {
          user: {
            id: 1,
            firstName: 'Alice',
            lastName: 'Ace',
            profilePictureUrl: 'a.png',
          },
        }),
      ] as any);
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([] as any);
      prisma.studentQuestionState.findMany.mockResolvedValue([] as any);
      prisma.questionAttempt.groupBy.mockResolvedValue([] as any);

      const result = await service.getStudents(MODULE_ID, {
        sortBy: 'name',
        sortDirection: 'asc',
      });

      expect(result.rows[0].fullName).toBe('Alice Ace');
      expect(result.rows[1].fullName).toBe('Zara Zoe');
    });

    it('searches by name (case-insensitive)', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([{ id: 10 }] as any);
      prisma.expLedger.groupBy.mockResolvedValue([] as any);
      prisma.userModule.findMany.mockResolvedValue([
        makeEnrollment(1, {
          user: {
            id: 1,
            firstName: 'Alice',
            lastName: 'Smith',
            profilePictureUrl: 'a.png',
          },
        }),
        makeEnrollment(2, {
          user: {
            id: 2,
            firstName: 'Bob',
            lastName: 'Jones',
            profilePictureUrl: 'b.png',
          },
        }),
      ] as any);
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([] as any);
      prisma.studentQuestionState.findMany.mockResolvedValue([] as any);
      prisma.questionAttempt.groupBy.mockResolvedValue([] as any);

      const result = await service.getStudents(MODULE_ID, {
        search: 'alice',
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].studentId).toBe(1);
    });

    it('returns averageMastery 0 when student has no progress', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([{ id: 10 }] as any);
      prisma.userModule.findMany.mockResolvedValue([makeEnrollment(1)] as any);
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([] as any);
      prisma.expLedger.groupBy.mockResolvedValue([] as any);
      prisma.studentQuestionState.findMany.mockResolvedValue([] as any);
      prisma.questionAttempt.groupBy.mockResolvedValue([] as any);

      const result = await service.getStudents(MODULE_ID, {});

      expect(result.rows[0].averageMastery).toBe(0);
    });
  });

  // ───── getLessons ─────

  describe('getLessons', () => {
    it('returns empty rows when no live lessons exist', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([] as any);

      const result = await service.getLessons(MODULE_ID, {});

      expect(result.rows).toEqual([]);
    });

    it('computes per-lesson aggregates correctly', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([
        { id: 10, title: 'Lesson A', status: 'live' },
        { id: 11, title: 'Lesson B', status: 'live' },
      ] as any);
      prisma.userModule.count.mockResolvedValue(5);

      // Progress aggregates: lesson 10 has 3 students started, avg mastery 75
      prisma.moduleUnitUserProgress.groupBy.mockResolvedValue([
        {
          moduleUnitId: 10,
          _count: { studentId: 3 },
          _avg: { currentMasteryScore: 0.75 },
          _max: { lastPracticedAt: THREE_DAYS_AGO },
        },
        {
          moduleUnitId: 11,
          _count: { studentId: 1 },
          _avg: { currentMasteryScore: 0.9 },
          _max: { lastPracticedAt: null },
        },
      ] as any);

      // Completed aggregates: lesson 10 has 2 completions
      (prisma.moduleUnitUserProgress.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          {
            moduleUnitId: 10,
            _count: { studentId: 3 },
            _avg: { currentMasteryScore: 0.75 },
            _max: { lastPracticedAt: THREE_DAYS_AGO },
          },
          {
            moduleUnitId: 11,
            _count: { studentId: 1 },
            _avg: { currentMasteryScore: 0.9 },
            _max: { lastPracticedAt: null },
          },
        ])
        .mockResolvedValueOnce([
          { moduleUnitId: 10, _count: { studentId: 2 } },
        ]);

      const result = await service.getLessons(MODULE_ID, {});

      expect(result.rows).toHaveLength(2);

      const lessonA = result.rows.find((r) => r.moduleUnitId === 10)!;
      expect(lessonA.studentsStarted).toBe(3);
      expect(lessonA.studentsCompleted).toBe(2);
      expect(lessonA.completionRate).toBe(40); // 2/5 * 100
      expect(lessonA.averageMastery).toBe(75);
      expect(lessonA.lastPracticedAt).toBe(THREE_DAYS_AGO.toISOString());

      const lessonB = result.rows.find((r) => r.moduleUnitId === 11)!;
      expect(lessonB.studentsCompleted).toBe(0);
      expect(lessonB.completionRate).toBe(0);
      expect(lessonB.lastPracticedAt).toBeNull();
    });

    it('sorts lessons by completion_rate descending', async () => {
      prisma.moduleUnit.findMany.mockResolvedValue([
        { id: 10, title: 'Low', status: 'live' },
        { id: 11, title: 'High', status: 'live' },
      ] as any);
      prisma.userModule.count.mockResolvedValue(10);
      prisma.moduleUnitUserProgress.groupBy
        .mockResolvedValueOnce([
          {
            moduleUnitId: 10,
            _count: { studentId: 2 },
            _avg: { currentMasteryScore: 0.5 },
            _max: { lastPracticedAt: null },
          },
          {
            moduleUnitId: 11,
            _count: { studentId: 8 },
            _avg: { currentMasteryScore: 0.8 },
            _max: { lastPracticedAt: null },
          },
        ] as any)
        .mockResolvedValueOnce([
          { moduleUnitId: 10, _count: { studentId: 1 } },
          { moduleUnitId: 11, _count: { studentId: 7 } },
        ] as any);

      const result = await service.getLessons(MODULE_ID, {
        sortBy: 'completion_rate',
        sortDirection: 'desc',
      });

      expect(result.rows[0].title).toBe('High');
      expect(result.rows[1].title).toBe('Low');
    });
  });

  // ───── getReview ─────

  describe('getReview', () => {
    it('returns empty rows when no students enrolled', async () => {
      prisma.userModule.findMany.mockResolvedValue([] as any);

      const result = await service.getReview(MODULE_ID, {});

      expect(result.rows).toEqual([]);
    });

    it('computes review counts and lapse totals correctly', async () => {
      prisma.userModule.findMany.mockResolvedValue([makeEnrollment(1)] as any);

      // Due states: 2 due (1 overdue + 1 due-today)
      prisma.studentQuestionState.findMany.mockResolvedValue([
        { userId: 1, fsrsDueAt: EIGHT_DAYS_AGO },
        { userId: 1, fsrsDueAt: NOW },
      ] as any);

      // Lapse aggregates
      prisma.studentQuestionState.groupBy.mockResolvedValue([
        { userId: 1, _sum: { lapseCount: 5 } },
      ] as any);

      dailyPracticeService.getDailyPracticeStatus.mockResolvedValue({
        status: 'completed',
      });

      prisma.dailyPracticeSet.findMany.mockResolvedValue([
        { userId: 1, completedAt: THREE_DAYS_AGO },
      ] as any);

      const result = await service.getReview(MODULE_ID, {});

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row.dueReviewCount).toBe(2);
      expect(row.overdueReviewCount).toBe(1); // only the 8-days-ago one
      expect(row.lapseCount).toBe(5);
      expect(row.dailyPracticeStatus).toBe('completed');
      expect(row.lastDailyPracticeCompletedAt).toBe(
        THREE_DAYS_AGO.toISOString(),
      );
    });

    it('sorts by overdue_review_count descending', async () => {
      prisma.userModule.findMany.mockResolvedValue([
        makeEnrollment(1),
        makeEnrollment(2),
      ] as any);

      prisma.studentQuestionState.findMany.mockResolvedValue([
        { userId: 2, fsrsDueAt: EIGHT_DAYS_AGO },
        { userId: 2, fsrsDueAt: EIGHT_DAYS_AGO },
      ] as any);
      prisma.studentQuestionState.groupBy.mockResolvedValue([
        { userId: 1, _sum: { lapseCount: 0 } },
        { userId: 2, _sum: { lapseCount: 1 } },
      ] as any);
      prisma.dailyPracticeSet.findMany.mockResolvedValue([] as any);

      const result = await service.getReview(MODULE_ID, {
        sortBy: 'overdue_review_count',
        sortDirection: 'desc',
      });

      expect(result.rows[0].studentId).toBe(2);
      expect(result.rows[0].overdueReviewCount).toBe(2);
      expect(result.rows[1].studentId).toBe(1);
      expect(result.rows[1].overdueReviewCount).toBe(0);
    });
  });

  // ───── getStudentDetail ─────

  describe('getStudentDetail', () => {
    it('throws NotFoundException when student not enrolled', async () => {
      prisma.userModule.findUnique.mockResolvedValue(null);

      await expect(service.getStudentDetail(MODULE_ID, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when user is a teacher, not a student', async () => {
      prisma.userModule.findUnique.mockResolvedValue({
        ...makeEnrollment(1),
        roleInModule: 'teacher',
      });

      await expect(service.getStudentDetail(MODULE_ID, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns full student detail with all blocks', async () => {
      prisma.userModule.findUnique.mockResolvedValue(makeEnrollment(1));
      prisma.moduleUnit.findMany.mockResolvedValue([
        { id: 10, title: 'Lesson A' },
        { id: 11, title: 'Lesson B' },
      ] as any);

      // Per-lesson progress
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([
        {
          moduleUnitId: 10,
          studentId: 1,
          isCompleted: true,
          currentMasteryScore: 0.85,
          completedAt: THREE_DAYS_AGO,
          lastPracticedAt: THREE_DAYS_AGO,
        },
      ] as any);

      // Ledger: lesson 10 has 600 baseline exp + 420 mastery exp
      // completionRate = 0.6, masteryRate = 0.6 → lessonMastery = 0.6*0.20 + 0.6*0.80 = 0.60
      // Lesson 11 has no entries → 0. averageMastery = (0.60 + 0) / 2 * 100 = 30
      prisma.expLedger.groupBy.mockResolvedValue([
        {
          moduleUnitId: 10,
          eventType: 'practice_room_answer_correct',
          _sum: { awardedExp: 600 },
        },
        {
          moduleUnitId: 10,
          eventType: 'daily_practice_mastery_encountered',
          _sum: { awardedExp: 420 },
        },
      ] as any);

      // FSRS review states
      prisma.studentQuestionState.findMany.mockResolvedValue([
        { fsrsDueAt: EIGHT_DAYS_AGO, lapseCount: 2 },
        { fsrsDueAt: NOW, lapseCount: 1 },
      ] as any);

      // Recent attempts (7 days)
      prisma.questionAttempt.findMany.mockResolvedValue([
        { isCorrect: true, timeTakenMs: 5000, hintsUsed: 0 },
        { isCorrect: false, timeTakenMs: 8000, hintsUsed: 1 },
        { isCorrect: true, timeTakenMs: 3000, hintsUsed: 0 },
      ] as any);

      dailyPracticeService.getDailyPracticeStatus.mockResolvedValue({
        status: 'available',
      });

      // Last activity
      prisma.questionAttempt.findFirst.mockResolvedValue({
        attemptedAt: THREE_DAYS_AGO,
      } as any);

      // Last daily practice completion
      prisma.dailyPracticeSet.findFirst.mockResolvedValue({
        completedAt: THREE_DAYS_AGO,
      } as any);

      const result = await service.getStudentDetail(MODULE_ID, 1);

      // Student overview
      expect(result.student.studentId).toBe(1);
      expect(result.student.fullName).toBe('First1 Last1');
      expect(result.student.completedLessons).toBe(1);
      expect(result.student.totalLiveLessons).toBe(2);
      expect(result.student.averageMastery).toBe(30); // (0.60 + 0) / 2 lessons * 100
      expect(result.student.dailyPracticeStatus).toBe('available');
      expect(result.student.lastActivityAt).toBe(THREE_DAYS_AGO.toISOString());

      // Lesson progress
      expect(result.lessonProgress).toHaveLength(2);
      expect(result.lessonProgress[0].isCompleted).toBe(true);
      expect(result.lessonProgress[0].currentMasteryScore).toBe(60); // 0.6*0.20 + 0.6*0.80 = 0.60
      expect(result.lessonProgress[1].isCompleted).toBe(false);
      expect(result.lessonProgress[1].currentMasteryScore).toBe(0);

      // Review state
      expect(result.reviewState.dueReviewCount).toBe(2);
      expect(result.reviewState.overdueReviewCount).toBe(1);
      expect(result.reviewState.lapseCount).toBe(3); // 2 + 1
      expect(result.reviewState.lastDailyPracticeCompletedAt).toBe(
        THREE_DAYS_AGO.toISOString(),
      );

      // Recent performance
      expect(result.recentPerformance.accuracyLast7Days).toBe(67); // 2/3 rounded
      expect(result.recentPerformance.averageTimeMsLast7Days).toBe(5333); // (5000+8000+3000)/3 rounded
      expect(result.recentPerformance.hintsUsedLast7Days).toBe(1);
    });

    it('returns null performance metrics when no recent attempts', async () => {
      prisma.userModule.findUnique.mockResolvedValue(makeEnrollment(1));
      prisma.moduleUnit.findMany.mockResolvedValue([] as any);
      prisma.moduleUnitUserProgress.findMany.mockResolvedValue([] as any);
      prisma.expLedger.groupBy.mockResolvedValue([] as any);
      prisma.studentQuestionState.findMany.mockResolvedValue([] as any);
      prisma.questionAttempt.findMany.mockResolvedValue([] as any);
      prisma.questionAttempt.findFirst.mockResolvedValue(null);
      prisma.dailyPracticeSet.findFirst.mockResolvedValue(null);
      dailyPracticeService.getDailyPracticeStatus.mockResolvedValue({
        status: 'locked',
      });

      const result = await service.getStudentDetail(MODULE_ID, 1);

      expect(result.recentPerformance.accuracyLast7Days).toBeNull();
      expect(result.recentPerformance.averageTimeMsLast7Days).toBeNull();
      expect(result.recentPerformance.hintsUsedLast7Days).toBeNull();
      expect(result.student.lastActivityAt).toBeNull();
      expect(result.reviewState.lastDailyPracticeCompletedAt).toBeNull();
    });
  });
});
