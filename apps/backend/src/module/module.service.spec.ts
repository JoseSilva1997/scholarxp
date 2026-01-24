import { runCrudServiceTests } from '../testing/test-helpers';
import { ModuleService } from './module.service';

runCrudServiceTests({
  name: 'ModuleService',
  service: ModuleService,
  modelName: 'module',
  entityLabel: 'Module',
  createDto: {
    institutionId: 5,
    ltiContextId: 'ctx-1',
    resourceLinkId: 'res-1',
    variantContext: 'var-1',
    title: 'Intro',
    description: 'desc',
  },
  updateDto: {
    title: 'Updated title',
  },
});
