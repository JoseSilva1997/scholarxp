import { runCrudServiceTests } from '../testing/test-helpers';
import { ModuleUnitService } from './module-unit.service';

runCrudServiceTests({
  name: 'ModuleUnitService',
  service: ModuleUnitService,
  modelName: 'moduleUnit',
  entityLabel: 'ModuleUnit',
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
