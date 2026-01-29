import { runCrudControllerTests } from '../../test/test-helpers';
import { UserModuleController } from './user-module.controller';
import { UserModuleService } from './user-module.service';

runCrudControllerTests({
  name: 'UserModuleController',
  controller: UserModuleController,
  service: UserModuleService,
  createDto: {
    moduleId: 1,
    userId: 2,
    roleInModule: 'student',
    userModuleLevel: 1,
    currentExp: 0,
    enrolledVia: 'invite' as any,
  },
  updateDto: {
    currentExp: 100,
  },
});
