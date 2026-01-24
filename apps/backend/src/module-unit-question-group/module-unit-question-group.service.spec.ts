import { runCrudServiceTests } from '../testing/test-helpers';
import { ModuleUnitQuestionGroupService } from './module-unit-question-group.service';

runCrudServiceTests({
  name: 'ModuleUnitQuestionGroupService',
  service: ModuleUnitQuestionGroupService,
  modelName: 'moduleUnitQuestionGroup',
  entityLabel: 'ModuleUnitQuestionGroup',
  createDto: {
    moduleUnitId: 1,
    name: 'Group 1',
    sortOrder: 1,
  },
  updateDto: {
    name: 'Updated Group',
  },
});
