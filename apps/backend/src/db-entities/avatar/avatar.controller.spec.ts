import { runCrudControllerTests } from '../../test/test-helpers';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';

runCrudControllerTests({
  name: 'AvatarController',
  controller: AvatarController,
  service: AvatarService,
  createDto: {
    userId: 1,
    level: 2,
    currentExp: 100,
  },
  updateDto: {
    level: 3,
  },
});
