// Spec role: verifies the practice-room stale-session sweep interval schedules closures and handles failures safely.
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PracticeRoomSessionService } from './practice-room-session.service';
import { PracticeRoomSessionSweepService } from './practice-room-session-sweep.service';

describe('PracticeRoomSessionSweepService', () => {
  let service: PracticeRoomSessionSweepService;
  const practiceRoomSessionService = {
    closeStaleSessions: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    practiceRoomSessionService.closeStaleSessions.mockReset();
    practiceRoomSessionService.closeStaleSessions.mockResolvedValue({
      closedCount: 0,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PracticeRoomSessionSweepService,
        {
          provide: PracticeRoomSessionService,
          useValue: practiceRoomSessionService,
        },
      ],
    }).compile();

    service = moduleRef.get(PracticeRoomSessionSweepService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs stale-session sweep every five minutes with a sixty-minute cutoff', async () => {
    service.onModuleInit();

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(practiceRoomSessionService.closeStaleSessions).toHaveBeenCalledWith({
      inactivityMinutes: 60,
    });
  });

  it('logs closed session count when stale sessions are closed', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    practiceRoomSessionService.closeStaleSessions.mockResolvedValueOnce({
      closedCount: 3,
    });
    service.onModuleInit();

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(logSpy).toHaveBeenCalledWith('Closed 3 stale practice session(s).');
  });

  it('logs errors and continues when sweep fails', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    practiceRoomSessionService.closeStaleSessions.mockRejectedValueOnce(
      new Error('db timeout'),
    );
    service.onModuleInit();

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to close stale practice sessions.',
      expect.any(String),
    );
  });
});
