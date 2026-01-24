import { runCrudControllerTests } from '../testing/test-helpers';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

runCrudControllerTests({
  name: 'UsersController',
  controller: UsersController,
  service: UsersService,
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
