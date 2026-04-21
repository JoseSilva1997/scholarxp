// Locks student profile aggregation rules so summary stats stay aligned with the quests the UI actually renders.
import { ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { DailyPracticeService } from '../daily-practice/daily-practice.service';
import { DailyLessonXpTrackService } from '../exp-engine/daily-lesson-xp-track.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuestStreakService } from '../quests/quest-streak.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import type { AuthUser } from '../types/auth-user.type';
import { StudentProfileService } from './student-profile.service';

describe('StudentProfileService', () => {
  let service: StudentProfileService;
  let prisma: PrismaMock;
  let questStreakService: { getCurrentStreakStatus: jest.Mock };
  let dailyLessonXpTrackService: { getTrackForUser: jest.Mock };
  let dailyPracticeService: { getDailyPracticeStatus: jest.Mock };

  const studentUser: AuthUser = {
    id: 42,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    profilePictureUrl: 'https://example.com/avatar.png',
    globalRole: 'student',
    isVerified: true,
    timezone: 'UTC',
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    questStreakService = {
      getCurrentStreakStatus: jest.fn(),
    };
    dailyLessonXpTrackService = {
      getTrackForUser: jest.fn(),
    };
    dailyPracticeService = {
      getDailyPracticeStatus: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StudentProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuestStreakService, useValue: questStreakService },
        {
          provide: DailyLessonXpTrackService,
          useValue: dailyLessonXpTrackService,
        },
        { provide: DailyPracticeService, useValue: dailyPracticeService },
      ],
    }).compile();

    service = moduleRef.get(StudentProfileService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('rejects non-student users before any profile aggregation work starts', async () => {
    await expect(
      service.getStudentProfile({
        ...studentUser,
        globalRole: GlobalRole.teacher,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('excludes completed master quests from the historical completed quest total', async () => {
    prisma.avatar.findUnique.mockResolvedValue({
      id: 7,
      totalExp: 180,
    } as never);
    prisma.dailyQuest.findMany.mockResolvedValue([
      { isCompleted: true, type: 'lesson' },
      { isCompleted: false, type: 'master_daily_quests' },
    ] as never);
    prisma.dailyQuest.count.mockResolvedValue(8);
    prisma.dailyQuest.groupBy
      .mockResolvedValueOnce([
        {
          questDateUtc: new Date('2026-03-24T00:00:00.000Z'),
          _count: { id: 3 },
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    questStreakService.getCurrentStreakStatus.mockResolvedValue({
      currentStreak: 3,
    });
    dailyLessonXpTrackService.getTrackForUser.mockResolvedValue(null);
    // Module aggregation is not relevant to this assertion, so keep the test focused on the quest summary contract.
    jest
      .spyOn(service as never, 'buildModulesForStudent')
      .mockResolvedValue([] as never);

    const profile = await service.getStudentProfile(studentUser);

    expect(prisma.dailyQuest.count).toHaveBeenCalledWith({
      where: {
        userId: studentUser.id,
        isCompleted: true,
        type: { not: 'master_daily_quests' },
      },
    });
    expect(profile.questHistorySummary).toEqual({
      totalCompleted: 8,
      perfectDays: 1,
    });
  });

  it('loads today quest progress from the student local day key instead of UTC midnight', async () => {
    prisma.avatar.findUnique.mockResolvedValue({
      id: 7,
      totalExp: 180,
    } as never);
    prisma.dailyQuest.findMany.mockResolvedValue([
      { isCompleted: true, type: 'complete_new_unit' },
      { isCompleted: false, type: 'master_daily_quests' },
    ] as never);
    prisma.dailyQuest.count.mockResolvedValue(0);
    prisma.dailyQuest.groupBy
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    questStreakService.getCurrentStreakStatus.mockResolvedValue({
      currentStreak: 1,
    });
    dailyLessonXpTrackService.getTrackForUser.mockResolvedValue(null);
    jest
      .spyOn(service as never, 'buildModulesForStudent')
      .mockResolvedValue([] as never);

    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T01:30:00.000Z'));

    await service.getStudentProfile({
      ...studentUser,
      timezone: 'America/Los_Angeles',
    });

    expect(prisma.dailyQuest.findMany).toHaveBeenCalledWith({
      where: {
        userId: studentUser.id,
        questDateUtc: new Date('2025-12-31T00:00:00.000Z'),
      },
      select: { isCompleted: true, type: true },
    });
  });
});
