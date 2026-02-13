import { runCrudControllerTests } from '../../test/test-helpers';
import { PracticeSessionController } from './practice-session.controller';
import { PracticeSessionService } from './practice-session.service';

runCrudControllerTests({
  name: 'PracticeSessionController',
  controller: PracticeSessionController,
  service: PracticeSessionService,
  // PracticeSession now uses UUID identifiers, so controller routes pass id strings through without numeric coercion.
  baseId: '11111111-1111-4111-8111-111111111111',
  parseId: (id: string) => id,
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
