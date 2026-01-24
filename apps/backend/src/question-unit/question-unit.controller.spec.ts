import { runCrudControllerTests } from '../testing/test-helpers';
import { QuestionUnitController } from './question-unit.controller';
import { QuestionUnitService } from './question-unit.service';

runCrudControllerTests({
  name: 'QuestionUnitController',
  controller: QuestionUnitController,
  service: QuestionUnitService,
  createDto: {
    moduleUnitId: 1,
    questionGroupId: 2,
    title: 'Unit title',
  },
  updateDto: {
    title: 'Updated title',
  },
});
