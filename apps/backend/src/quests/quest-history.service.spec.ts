// Role: verifies quest read orchestration so generation runs before persisted quest history is returned.
import { Test, TestingModule } from '@nestjs/testing';
import { DailyQuestService } from '../db-entities/daily-quest/daily-quest.service';
import { QuestGenerationService } from './quest-generation.service';
import { QuestHistoryService } from './quest-history.service';

describe('QuestHistoryService', () => {
  let service: QuestHistoryService;
  let questGenerationService: {
    ensureQuestDayGeneratedForUser: jest.Mock;
  };
  let dailyQuestService: {
    listHistoryForUser: jest.Mock;
  };

  beforeEach(async () => {
    questGenerationService = {
      ensureQuestDayGeneratedForUser: jest.fn(),
    };
    dailyQuestService = {
      listHistoryForUser: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuestHistoryService,
        {
          provide: QuestGenerationService,
          useValue: questGenerationService,
        },
        {
          provide: DailyQuestService,
          useValue: dailyQuestService,
        },
      ],
    }).compile();

    service = moduleRef.get(QuestHistoryService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('ensures the quest day exists before reading history', async () => {
    const query = { dayLimit: 14, dayOffset: 0 };
    const response = { quests: [], hasMore: false, nextDayOffset: null };
    questGenerationService.ensureQuestDayGeneratedForUser.mockResolvedValue(
      undefined,
    );
    dailyQuestService.listHistoryForUser.mockResolvedValue(response);

    const result = await service.listHistoryForUser(7, query);

    expect(
      questGenerationService.ensureQuestDayGeneratedForUser,
    ).toHaveBeenCalledWith(7);
    expect(dailyQuestService.listHistoryForUser).toHaveBeenCalledWith(7, query);
    expect(result).toEqual(response);
  });
});
