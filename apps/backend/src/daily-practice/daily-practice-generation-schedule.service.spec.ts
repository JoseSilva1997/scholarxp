// Role: verifies daily-practice boot and cron triggers call the shared batch generator and isolate scheduler failures.
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DailyPracticeGenerationBatchService } from './daily-practice-generation-batch.service';
import { DailyPracticeGenerationScheduleService } from './daily-practice-generation-schedule.service';

describe('DailyPracticeGenerationScheduleService', () => {
  let service: DailyPracticeGenerationScheduleService;
  let dailyPracticeGenerationBatchService: {
    generateDailyPracticeSetsForAllStudents: jest.Mock;
  };

  beforeEach(async () => {
    dailyPracticeGenerationBatchService = {
      generateDailyPracticeSetsForAllStudents: jest.fn().mockResolvedValue({
        processedMembershipCount: 4,
        createdSetCount: 2,
        failedMembershipCount: 1,
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeGenerationScheduleService,
        {
          provide: DailyPracticeGenerationBatchService,
          useValue: dailyPracticeGenerationBatchService,
        },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeGenerationScheduleService);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('delegates module init to the startup generation path', () => {
    const startupSpy = jest
      .spyOn(service, 'runStartupGeneration')
      .mockResolvedValue(undefined);

    service.onModuleInit();

    expect(startupSpy).toHaveBeenCalledTimes(1);
  });

  it('runs startup generation and logs the batch summary', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await service.runStartupGeneration();

    expect(
      dailyPracticeGenerationBatchService.generateDailyPracticeSetsForAllStudents,
    ).toHaveBeenCalledWith(expect.any(Date), undefined, {
      onlyLocalMidnightWindow: false,
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Completed startup daily-practice generation for 4 enrollment(s), created 2 set(s), with 1 failure(s).',
    );
  });

  it('runs the scheduled generation window handler and logs the batch summary', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await service.handleScheduledGenerationWindow();

    expect(
      dailyPracticeGenerationBatchService.generateDailyPracticeSetsForAllStudents,
    ).toHaveBeenCalledWith(expect.any(Date), undefined, {
      onlyLocalMidnightWindow: true,
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Completed scheduled daily-practice generation for 4 enrollment(s), created 2 set(s), with 1 failure(s).',
    );
  });

  it('swallows scheduler failures after logging them', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    dailyPracticeGenerationBatchService.generateDailyPracticeSetsForAllStudents.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(
      service.handleScheduledGenerationWindow(),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed scheduled daily-practice generation.',
      expect.any(String),
    );
  });
});
