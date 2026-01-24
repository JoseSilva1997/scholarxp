import { runCrudControllerTests } from '../testing/test-helpers';
import { DailyQuestController } from './daily-quest.controller';
import { DailyQuestService } from './daily-quest.service';

runCrudControllerTests({
  name: 'DailyQuestController',
  controller: DailyQuestController,
  service: DailyQuestService,
  createDto: {
    moduleId: 1,
    userId: 2,
    type: 'practice',
    expGranted: 10,
    isCompleted: false,
  },
  updateDto: {
    isCompleted: true,
  },
});
