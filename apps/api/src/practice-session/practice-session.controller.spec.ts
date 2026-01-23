import { runCrudControllerTests } from '../testing/test-helpers';
import { PracticeSessionController } from './practice-session.controller';
import { PracticeSessionService } from './practice-session.service';

runCrudControllerTests({
  name: 'PracticeSessionController',
  controller: PracticeSessionController,
  service: PracticeSessionService,
  createDto: {
    moduleId: 1,
    userId: 2,
    startTime: '2024-01-01T10:00:00.000Z',
    endTime: '2024-01-01T11:00:00.000Z',
  },
  updateDto: {
    endTime: null as any,
  },
});
