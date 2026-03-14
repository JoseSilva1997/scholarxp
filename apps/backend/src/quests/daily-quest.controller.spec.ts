// Role: verifies quest routes stay thin and delegate authenticated reads to the quest orchestration service.
import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { DailyQuestController } from './daily-quest.controller';
import { QuestHistoryService } from './quest-history.service';
import { QuestProgressService } from './quest-progress.service';
import { QuestStreakService } from './quest-streak.service';

describe('DailyQuestController', () => {
  let controller: DailyQuestController;
  let questHistoryService: {
    listHistoryForUser: jest.Mock;
  };
  let questProgressService: {
    recordDailyRevisionButtonClick: jest.Mock;
    recordCompletedUnitReview: jest.Mock;
  };
  let questStreakService: {
    getCurrentStreakStatus: jest.Mock;
  };

  beforeEach(async () => {
    questHistoryService = {
      listHistoryForUser: jest.fn(),
    };
    questProgressService = {
      recordDailyRevisionButtonClick: jest.fn(),
      recordCompletedUnitReview: jest.fn(),
    };
    questStreakService = {
      getCurrentStreakStatus: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DailyQuestController],
      providers: [
        { provide: QuestHistoryService, useValue: questHistoryService },
        { provide: QuestProgressService, useValue: questProgressService },
        { provide: QuestStreakService, useValue: questStreakService },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(DailyQuestController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('getMyQuestHistory forwards authenticated user id and query', async () => {
    const request = { user: { id: 7 } } as never;
    const query = { dayLimit: 14, dayOffset: 0 };
    const response = { quests: [], hasMore: false, nextDayOffset: null };
    questHistoryService.listHistoryForUser.mockResolvedValue(response);

    const result = await controller.getMyQuestHistory(request, query as never);

    // Controller owns extracting session user id; quest services own generation and read orchestration.
    expect(questHistoryService.listHistoryForUser).toHaveBeenCalledWith(
      7,
      query,
    );
    expect(result).toEqual(response);
  });

  it('getMyMasterQuestStreak forwards the authenticated user id to the streak service', async () => {
    const request = { user: { id: 7 } } as never;
    const response = {
      currentStreak: 2,
      maxStreak: 5,
      bonusPercent: 20,
      bonusPercentPerStep: 10,
      lastCompletedQuestDateUtc: '2026-03-13',
    };
    questStreakService.getCurrentStreakStatus.mockResolvedValue(response);

    const result = await controller.getMyMasterQuestStreak(request);

    expect(questStreakService.getCurrentStreakStatus).toHaveBeenCalledWith(
      7,
      expect.any(Date),
    );
    expect(result).toEqual(response);
  });

  it('recordDailyRevisionClick forwards module-scoped progress trigger to the quest progress service', async () => {
    const request = { user: { id: 7 } } as never;
    questProgressService.recordDailyRevisionButtonClick.mockResolvedValue(
      undefined,
    );

    const result = await controller.recordDailyRevisionClick(request, {
      moduleId: 42,
    });

    expect(
      questProgressService.recordDailyRevisionButtonClick,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        moduleId: 42,
      }),
    );
    expect(result).toEqual({ recorded: true });
  });

  it('recordCompletedUnitReview forwards review triggers with module and unit ids', async () => {
    const request = { user: { id: 7 } } as never;
    questProgressService.recordCompletedUnitReview.mockResolvedValue(undefined);

    const result = await controller.recordCompletedUnitReview(request, {
      moduleId: 42,
      moduleUnitId: 9,
    });

    expect(questProgressService.recordCompletedUnitReview).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        moduleId: 42,
        moduleUnitId: 9,
      }),
    );
    expect(result).toEqual({ recorded: true });
  });
});
