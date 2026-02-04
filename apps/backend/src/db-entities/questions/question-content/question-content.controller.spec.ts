import { runCrudControllerTests } from '../../../test/test-helpers';
import { QuestionContentController } from './question-content.controller';
import { QuestionContentService } from './question-content.service';

runCrudControllerTests({
  name: 'QuestionContentController',
  controller: QuestionContentController,
  service: QuestionContentService,
  createDto: {
    type: 'mcq',
    questionStem: 'What is 2+2?',
    questionData: { choices: [2, 3, 4] },
    questionUnitId: 1,
    isCore: true,
    hint: 'Arithmetic',
    difficultyScore: 0.5,
    source: 'system',
    status: 'draft',
  },
  updateDto: {
    status: 'published',
  },
});
