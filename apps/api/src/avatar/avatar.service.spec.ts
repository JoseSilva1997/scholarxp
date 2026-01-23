import { runCrudServiceTests } from '../testing/test-helpers';
import { AvatarService } from './avatar.service';

runCrudServiceTests({
  name: 'AvatarService',
  service: AvatarService,
  modelName: 'avatar',
  entityLabel: 'Avatar',
  createDto: {
    userId: 1,
    level: 2,
    currentExp: 100,
  },
  updateDto: {
    level: 3,
  },
});
