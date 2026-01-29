import { runCrudControllerTests } from '../../test/test-helpers';
import { ModuleUnitUserProgressController } from './module-unit-user-progress.controller';
import { ModuleUnitUserProgressService } from './module-unit-user-progress.service';

runCrudControllerTests({
  name: 'ModuleUnitUserProgressController',
  controller: ModuleUnitUserProgressController,
  service: ModuleUnitUserProgressService,
  createDto: {
    moduleUnitId: 1,
    studentId: 2,
    currentMasteryScore: 0.6,
    isCompleted: false,
    noOfCorrectAnswers: 3,
    completedAt: null,
    lastPracticedAt: null,
  },
  updateDto: {
    currentMasteryScore: 0.8,
    isCompleted: true,
  },
});
