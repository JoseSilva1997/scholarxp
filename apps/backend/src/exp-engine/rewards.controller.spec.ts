// Spec role: verifies reward routes stay thin and delegate authenticated reads to the standalone reward-track service.
import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { DailyLessonXpTrackService } from './daily-lesson-xp-track.service';
import { RewardsController } from './rewards.controller';

describe('RewardsController', () => {
  let controller: RewardsController;
  let dailyLessonXpTrackService: {
    getTrackForUser: jest.Mock;
  };

  beforeEach(async () => {
    dailyLessonXpTrackService = {
      getTrackForUser: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RewardsController],
      providers: [
        {
          provide: DailyLessonXpTrackService,
          useValue: dailyLessonXpTrackService,
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(RewardsController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('forwards the authenticated user id to the daily lesson XP track service', async () => {
    const request = { user: { id: 9 } } as never;
    const response = {
      dayKeyUtc: '2026-03-15',
      completedLessonsToday: 1,
      nextRewardXp: 25,
      resetsAtUtc: '2026-03-16T00:00:00.000Z',
      steps: [],
    };
    dailyLessonXpTrackService.getTrackForUser.mockResolvedValue(response);

    const result = await controller.getMyDailyLessonXpTrack(request);

    expect(dailyLessonXpTrackService.getTrackForUser).toHaveBeenCalledWith(
      9,
      expect.any(Date),
    );
    expect(result).toEqual(response);
  });
});
