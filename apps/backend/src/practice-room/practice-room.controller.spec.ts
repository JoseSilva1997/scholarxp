// Verifies PracticeRoomController stays thin and forwards scoped route data to PracticeRoomService.
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PracticeRoomController } from './practice-room.controller';
import { PracticeRoomService } from './practice-room.service';
import { buildSubmitAttemptPayload } from './practice-room.test-helpers';

describe('PracticeRoomController', () => {
  let controller: PracticeRoomController;
  let practiceRoomService: {
    getPracticeRoom: jest.Mock;
    submitAttempt: jest.Mock;
    closeSession: jest.Mock;
  };

  const request = { user: { id: 99 } } as never;
  const params = { moduleId: 4, moduleUnitId: 8 };

  beforeEach(async () => {
    practiceRoomService = {
      getPracticeRoom: jest.fn(),
      submitAttempt: jest.fn(),
      closeSession: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PracticeRoomController],
      providers: [
        { provide: PracticeRoomService, useValue: practiceRoomService },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(PracticeRoomController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('forwards room query parameters and authenticated user id', async () => {
    const response = { practiceRoom: { sessionId: 'session-1' } };
    practiceRoomService.getPracticeRoom.mockResolvedValue(response);

    const result = await controller.getPracticeRoom(
      params,
      { sessionId: 'session-1', sessionType: 'retry' },
      request,
    );

    expect(practiceRoomService.getPracticeRoom).toHaveBeenCalledWith(
      4,
      8,
      99,
      'session-1',
      'retry',
    );
    expect(result).toBe(response);
  });

  it('forwards attempt payloads with module scope and authenticated user id', async () => {
    const payload = buildSubmitAttemptPayload();
    const response = { isCorrect: true };
    practiceRoomService.submitAttempt.mockResolvedValue(response);

    const result = await controller.submitAttempt(params, payload, request);

    expect(practiceRoomService.submitAttempt).toHaveBeenCalledWith(
      4,
      8,
      99,
      payload,
    );
    expect(result).toBe(response);
  });

  it('forwards close-session requests with all route ids', async () => {
    const response = { sessionId: 'session-1', closed: true };
    practiceRoomService.closeSession.mockResolvedValue(response);

    const result = await controller.closeSession(
      { ...params, sessionId: 'session-1' },
      request,
    );

    expect(practiceRoomService.closeSession).toHaveBeenCalledWith(
      4,
      8,
      99,
      'session-1',
    );
    expect(result).toBe(response);
  });
});
