// Role: verifies that daily-practice routes stay thin, extract the session user correctly, and delegate to DailyPracticeService.
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { DailyPracticeController } from './daily-practice.controller';
import { DailyPracticeService } from './daily-practice.service';
import type { CloseDailyPracticeSessionParamsDto } from './dto/close-daily-practice-session-params.dto';
import type { GetDailyPracticeParamsDto } from './dto/get-daily-practice-params.dto';
import type { GetDailyPracticeQueryDto } from './dto/get-daily-practice-query.dto';
import type { SubmitDailyPracticeAttemptDto } from './dto/submit-daily-practice-attempt.dto';

describe('DailyPracticeController', () => {
  let controller: DailyPracticeController;
  let dailyPracticeService: {
    getTodayDailyPractice: jest.Mock;
    submitAttempt: jest.Mock;
    closeSession: jest.Mock;
  };

  beforeEach(async () => {
    dailyPracticeService = {
      getTodayDailyPractice: jest.fn(),
      submitAttempt: jest.fn(),
      closeSession: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DailyPracticeController],
      providers: [
        { provide: DailyPracticeService, useValue: dailyPracticeService },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(DailyPracticeController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ── getToday ───────────────────────────────────────────────────────────────

  describe('getToday', () => {
    it('forwards moduleId, user id, and optional sessionId to the service', async () => {
      const response = { setId: 'set-1', questions: [] };
      dailyPracticeService.getTodayDailyPractice.mockResolvedValue(response);

      const params = { moduleId: 7 } as GetDailyPracticeParamsDto;
      const query = { sessionId: 'session-uuid' } as GetDailyPracticeQueryDto;
      const req = { user: { id: 42 } } as never;

      const result = await controller.getToday(params, query, req);

      expect(dailyPracticeService.getTodayDailyPractice).toHaveBeenCalledWith(
        7,
        42,
        'session-uuid',
      );
      expect(result).toEqual(response);
    });

    it('passes undefined sessionId when the query param is absent', async () => {
      dailyPracticeService.getTodayDailyPractice.mockResolvedValue({});

      const params = { moduleId: 7 } as GetDailyPracticeParamsDto;
      const query = {} as GetDailyPracticeQueryDto;
      const req = { user: { id: 42 } } as never;

      await controller.getToday(params, query, req);

      expect(dailyPracticeService.getTodayDailyPractice).toHaveBeenCalledWith(
        7,
        42,
        undefined,
      );
    });

    it('returns whatever the service resolves', async () => {
      const response = { setId: 'set-1', questions: [{ id: 1 }] };
      dailyPracticeService.getTodayDailyPractice.mockResolvedValue(response);

      const result = await controller.getToday(
        { moduleId: 7 } as GetDailyPracticeParamsDto,
        {} as GetDailyPracticeQueryDto,
        { user: { id: 42 } } as never,
      );

      expect(result).toEqual(response);
    });
  });

  // ── submitAttempt ──────────────────────────────────────────────────────────

  describe('submitAttempt', () => {
    it('forwards moduleId, user id, and full payload to the service', async () => {
      const response = { correct: true };
      dailyPracticeService.submitAttempt.mockResolvedValue(response);

      const params = { moduleId: 7 } as GetDailyPracticeParamsDto;
      const payload: SubmitDailyPracticeAttemptDto = {
        setId: 'set-1',
        moduleUnitId: 1,
        questionUnitId: 10,
        questionContentId: 100,
        sessionId: 'session-uuid',
        timeTakenMs: 5000,
        hintUnlocked: false,
        studentAnswer: { type: 'multiple_choice', selectedOptionId: 3 } as any,
      };
      const req = { user: { id: 42 } } as never;

      const result = await controller.submitAttempt(params, payload, req);

      expect(dailyPracticeService.submitAttempt).toHaveBeenCalledWith(
        7,
        42,
        payload,
      );
      expect(result).toEqual(response);
    });
  });

  // ── closeSession ───────────────────────────────────────────────────────────

  describe('closeSession', () => {
    it('forwards moduleId, user id, and sessionId to the service', async () => {
      const response = { closed: true };
      dailyPracticeService.closeSession.mockResolvedValue(response);

      const params: CloseDailyPracticeSessionParamsDto = {
        moduleId: 7,
        sessionId: 'session-uuid',
      };
      const req = { user: { id: 42 } } as never;

      const result = await controller.closeSession(params, req);

      expect(dailyPracticeService.closeSession).toHaveBeenCalledWith(
        7,
        42,
        'session-uuid',
      );
      expect(result).toEqual(response);
    });
  });
});
