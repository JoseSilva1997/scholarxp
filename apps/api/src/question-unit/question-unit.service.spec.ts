import { runCrudServiceTests } from '../testing/test-helpers';
import { QuestionUnitService } from './question-unit.service';

runCrudServiceTests({
  name: 'QuestionUnitService',
  service: QuestionUnitService,
  modelName: 'questionUnit',
  entityLabel: 'QuestionUnit',
  createDto: {
    moduleUnitId: 1,
    questionGroupId: 2,
    title: 'Unit title',
  },
  updateDto: {
    title: 'Updated title',
  },
});
