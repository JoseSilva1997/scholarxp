import { runCrudServiceTests } from '../testing/test-helpers';
import { UsersService } from './users.service';

runCrudServiceTests({
  name: 'UsersService',
  service: UsersService,
  modelName: 'user',
  entityLabel: 'User',
  createDto: {
    firstName: 'Test',
    lastName: 'User',
    email: 'user@example.com',
    globalRole: 'student' as any,
  },
  updateDto: {
    firstName: 'Updated',
  },
});
