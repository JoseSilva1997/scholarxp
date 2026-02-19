// Verifies that DailyQuestController routes delegate to DailyQuestService with parsed IDs and authenticated user context.
import { Test, TestingModule } from '@nestjs/testing';
import { DailyQuestController } from './daily-quest.controller';
import { DailyQuestService } from './daily-quest.service';

describe('DailyQuestController', () => {
  let controller: DailyQuestController;
  let service: {
    create: jest.Mock;
    listHistoryForUser: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      listHistoryForUser: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DailyQuestController],
      providers: [{ provide: DailyQuestService, useValue: service }],
    }).compile();

    controller = moduleRef.get(DailyQuestController);
  });

  afterEach(() => jest.resetAllMocks());

  it('create forwards DTO to the service', async () => {
    const createDto = {
      moduleId: 1,
      userId: 2,
      type: 'complete_daily_practice',
      expGranted: 10,
      isCompleted: false,
    } as const;
    const response = { id: 10, ...createDto };
    service.create.mockResolvedValue(response);

    const result = await controller.create(createDto as never);

    expect(service.create).toHaveBeenCalledWith(createDto);
    expect(result).toEqual(response);
  });

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

  it('findOne parses id and delegates', async () => {
    const response = { id: 21 };
    service.findOne.mockResolvedValue(response);

    const result = await controller.findOne('21');

    expect(service.findOne).toHaveBeenCalledWith(21);
    expect(result).toEqual(response);
  });

  it('update parses id and forwards DTO', async () => {
    const updateDto = { isCompleted: true };
    const response = { id: 21, ...updateDto };
    service.update.mockResolvedValue(response);

    const result = await controller.update('21', updateDto as never);

    expect(service.update).toHaveBeenCalledWith(21, updateDto);
    expect(result).toEqual(response);
  });

  it('remove parses id and delegates', async () => {
    const response = { id: 21 };
    service.remove.mockResolvedValue(response);

    const result = await controller.remove('21');

    expect(service.remove).toHaveBeenCalledWith(21);
    expect(result).toEqual(response);
  });
});
