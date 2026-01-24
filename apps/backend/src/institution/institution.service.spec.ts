import { runCrudServiceTests } from '../testing/test-helpers';
import { InstitutionService } from './institution.service';

runCrudServiceTests({
  name: 'InstitutionService',
  service: InstitutionService,
  modelName: 'institution',
  entityLabel: 'Institution',
  createDto: {
    name: 'Uni',
    lmsPlatform: 'canvas',
    lmsIssuerUrl: 'https://issuer',
    lmsClientId: 'client-1',
    lmsDeploymentId: 'deploy-1',
    jwksUrl: 'https://issuer/jwks',
    authTokenUrl: 'https://issuer/token',
    authRequestUrl: 'https://issuer/auth',
  },
  updateDto: {
    name: 'Updated Uni',
  },
});
