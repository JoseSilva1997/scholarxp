import { runCrudServiceTests } from '../../test/test-helpers';
import { ModuleInviteService } from './module-invite.service';

runCrudServiceTests({
  name: 'ModuleInviteService',
  service: ModuleInviteService,
  modelName: 'moduleInvite',
  entityLabel: 'ModuleInvite',
  createDto: {
    moduleId: 1,
    createdByUserId: 2,
    type: 'code' as any,
    tokenHash: 'hash',
    emailLock: 'student@example.com',
    maxUses: 1,
    uses: 0,
    expiresAt: new Date().toISOString(),
  },
  updateDto: {
    uses: 1,
    revokedAt: new Date().toISOString(),
  },
});
