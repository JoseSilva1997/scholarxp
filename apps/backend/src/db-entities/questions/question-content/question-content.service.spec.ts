import { runCrudServiceTests } from '../../../test/test-helpers';
import { QuestionContentService } from './question-content.service';

runCrudServiceTests({
  name: 'QuestionContentService',
  service: QuestionContentService,
  modelName: 'questionContent',
  entityLabel: 'QuestionContent',
  createDto: {
    type: 'mcq',
    questionStem: 'What is 2+2?',
    questionData: { choices: [2, 3, 4] },
    questionUnitId: 1,
    isCore: true,
    hint: 'Arithmetic',
    source: 'system',
    isArchived: false,
  },
  updateDto: {
    isArchived: true,
  },
});
