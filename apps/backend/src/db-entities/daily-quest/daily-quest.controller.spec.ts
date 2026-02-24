// Verifies that DailyQuestController routes delegate to DailyQuestService with parsed IDs and authenticated user context.
import { Test, TestingModule } from '@nestjs/testing';
import { DailyQuestController } from './daily-quest.controller';
import { DailyQuestService } from './daily-quest.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';

describe('DailyQuestController', () => {
  let controller: DailyQuestController;
  let service: {
    create: jest.Mock;
    listHistoryForUser: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      listHistoryForUser: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DailyQuestController],
      providers: [{ provide: DailyQuestService, useValue: service }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(DailyQuestController);
  });

  afterEach(() => jest.resetAllMocks());

  it('getMyQuestHistory forwards authenticated user id and query', async () => {
    const request = { user: { id: 7 } } as never;
    const query = { dayLimit: 14, dayOffset: 0 };
    const response = { quests: [], hasMore: false, nextDayOffset: null };
    service.listHistoryForUser.mockResolvedValue(response);

    const result = await controller.getMyQuestHistory(request, query as never);

    // Controller owns extracting session user id; service owns history selection logic.
    expect(service.listHistoryForUser).toHaveBeenCalledWith(7, query);
    expect(result).toEqual(response);
  });

  // Other CRUD endpoints were removed as they are unused by frontend flows.
});
