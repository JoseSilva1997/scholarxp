import { runCrudControllerTests } from '../../test/test-helpers';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';

runCrudControllerTests({
  name: 'InstitutionController',
  controller: InstitutionController,
  service: InstitutionService,
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
