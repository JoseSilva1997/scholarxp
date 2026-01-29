import { runCrudControllerTests } from '../../test/test-helpers';
import { AuthIdentityController } from './auth-identity.controller';
import { AuthIdentityService } from './auth-identity.service';

runCrudControllerTests({
  name: 'AuthIdentityController',
  controller: AuthIdentityController,
  service: AuthIdentityService,
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
