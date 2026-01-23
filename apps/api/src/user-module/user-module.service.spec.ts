import { runCrudServiceTests } from '../testing/test-helpers';
import { UserModuleService } from './user-module.service';

runCrudServiceTests({
  name: 'UserModuleService',
  service: UserModuleService,
  modelName: 'userModule',
  entityLabel: 'UserModule',
  createDto: {
    moduleId: 1,
    userId: 2,
    roleInModule: 'student',
    userModuleLevel: 1,
    currentExp: 0,
  },
  updateDto: {
    currentExp: 100,
  },
});
