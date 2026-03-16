// Spec role: verifies startup quest generation runs once during module init and does not crash the app on failures.
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QuestGenerationBatchService } from './quest-generation-batch.service';
import { QuestGenerationStartupService } from './quest-generation-startup.service';

describe('QuestGenerationStartupService', () => {
  let service: QuestGenerationStartupService;
  const questGenerationBatchService = {
    generateQuestDayForAllStudents: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-15T10:15:00.000Z'));
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    questGenerationBatchService.generateQuestDayForAllStudents.mockReset();
    questGenerationBatchService.generateQuestDayForAllStudents.mockResolvedValue(
      {
        processedUserCount: 3,
        failedUserCount: 0,
      },
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        QuestGenerationStartupService,
        {
          provide: QuestGenerationBatchService,
          useValue: questGenerationBatchService,
        },
      ],
    }).compile();

    service = moduleRef.get(QuestGenerationStartupService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('generates today quest data once on module init', async () => {
    service.onModuleInit();
    await jest.runAllTimersAsync();

    expect(
      questGenerationBatchService.generateQuestDayForAllStudents,
    ).toHaveBeenCalledTimes(1);
    expect(
      questGenerationBatchService.generateQuestDayForAllStudents,
    ).toHaveBeenCalledWith(new Date('2026-03-15T10:15:00.000Z'));
  });

  it('logs failures without throwing during startup', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    questGenerationBatchService.generateQuestDayForAllStudents.mockRejectedValueOnce(
      new Error('database timeout'),
    );

    expect(() => service.onModuleInit()).not.toThrow();
    await jest.runAllTimersAsync();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to generate startup daily quests.',
      expect.any(String),
    );
  });
});
