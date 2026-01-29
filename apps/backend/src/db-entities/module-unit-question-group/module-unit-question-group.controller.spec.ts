import { runCrudControllerTests } from '../../test/test-helpers';
import { ModuleUnitQuestionGroupController } from './module-unit-question-group.controller';
import { ModuleUnitQuestionGroupService } from './module-unit-question-group.service';

runCrudControllerTests({
  name: 'ModuleUnitQuestionGroupController',
  controller: ModuleUnitQuestionGroupController,
  service: ModuleUnitQuestionGroupService,
  createDto: {
    moduleUnitId: 1,
    name: 'Group 1',
    sortOrder: 1,
  },
  updateDto: {
    name: 'Updated Group',
  },
});
