import { runCrudControllerTests } from '../testing/test-helpers';
import { ModuleUnitController } from './module-unit.controller';
import { ModuleUnitService } from './module-unit.service';

runCrudControllerTests({
  name: 'ModuleUnitController',
  controller: ModuleUnitController,
  service: ModuleUnitService,
  createDto: {
    moduleId: 1,
    variantContext: 'ctx',
    title: 'Unit 1',
    questionCount: 3,
    status: 'draft' as any,
    sortOrder: 1,
  },
  updateDto: {
    title: 'Updated Unit',
  },
});
