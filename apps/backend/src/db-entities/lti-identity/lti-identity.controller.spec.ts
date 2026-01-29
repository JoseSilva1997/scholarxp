import { runCrudControllerTests } from '../../test/test-helpers';
import { LtiIdentityController } from './lti-identity.controller';
import { LtiIdentityService } from './lti-identity.service';

runCrudControllerTests({
  name: 'LtiIdentityController',
  controller: LtiIdentityController,
  service: LtiIdentityService,
  createDto: {
    institutionId: 1,
    userId: 2,
    ltiUserId: 'lti-123',
  },
  updateDto: {
    ltiUserId: 'lti-456',
  },
});
