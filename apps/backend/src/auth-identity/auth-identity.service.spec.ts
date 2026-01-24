import { runCrudServiceTests } from '../testing/test-helpers';
import { AuthIdentityService } from './auth-identity.service';

runCrudServiceTests({
  name: 'AuthIdentityService',
  service: AuthIdentityService,
  modelName: 'authIdentity',
  entityLabel: 'AuthIdentity',
  createDto: {
    userId: 1,
    provider: 'google',
    providerUserId: 'google-123',
    email: 'student@example.com',
  },
  updateDto: {
    email: 'updated@example.com',
  },
});
