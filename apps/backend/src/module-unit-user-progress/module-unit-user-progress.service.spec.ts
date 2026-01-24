import { runCrudServiceTests } from '../testing/test-helpers';
import { ModuleUnitUserProgressService } from './module-unit-user-progress.service';

runCrudServiceTests({
  name: 'ModuleUnitUserProgressService',
  service: ModuleUnitUserProgressService,
  modelName: 'moduleUnitUserProgress',
  entityLabel: 'ModuleUnitUserProgress',
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
