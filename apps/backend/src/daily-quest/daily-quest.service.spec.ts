import { runCrudServiceTests } from '../testing/test-helpers';
import { DailyQuestService } from './daily-quest.service';

runCrudServiceTests({
  name: 'DailyQuestService',
  service: DailyQuestService,
  modelName: 'dailyQuest',
  entityLabel: 'DailyQuest',
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
