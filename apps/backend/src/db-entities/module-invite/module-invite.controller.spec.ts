import { runCrudControllerTests } from '../../test/test-helpers';
import { ModuleInviteController } from './module-invite.controller';
import { ModuleInviteService } from './module-invite.service';

runCrudControllerTests({
  name: 'ModuleInviteController',
  controller: ModuleInviteController,
  service: ModuleInviteService,
  createDto: {
    moduleId: 1,
    createdByUserId: 2,
    type: 'link' as any,
    tokenHash: 'hash',
  },
  updateDto: {
    maxUses: 5,
  },
});
