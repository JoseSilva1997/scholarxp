import { runCrudServiceTests } from '../testing/test-helpers';
import { LtiIdentityService } from './lti-identity.service';

runCrudServiceTests({
  name: 'LtiIdentityService',
  service: LtiIdentityService,
  modelName: 'ltiIdentity',
  entityLabel: 'LtiIdentity',
  createDto: {
    institutionId: 1,
    userId: 2,
    ltiUserId: 'lti-123',
  },
  updateDto: {
    ltiUserId: 'lti-456',
  },
});
