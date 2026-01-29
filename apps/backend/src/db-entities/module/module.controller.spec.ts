import { runCrudControllerTests } from '../../test/test-helpers';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';

runCrudControllerTests({
  name: 'ModuleController',
  controller: ModuleController,
  service: ModuleService,
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
