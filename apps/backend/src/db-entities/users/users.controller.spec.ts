import { Test, TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthService } from '../../auth/auth.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';

// Verifies that users controller only exposes role mutation and returns refreshed auth payload.
describe('UsersController', () => {
  let controller: UsersController;
  const service = {
    updateRole: jest.fn(),
  };
  const authService = {
    getUserById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: service },
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(UsersController);
    jest.clearAllMocks();
  });

  it('forwards role updates to updateRole via /:id/role', async () => {
    const response = { id: 1, globalRole: GlobalRole.student, avatar: null };
    service.updateRole.mockResolvedValue({ id: 1 });
    authService.getUserById.mockResolvedValue(response);

    const result = await controller.updateRole(1, {
      globalRole: GlobalRole.student,
    } as any);

    expect(service.updateRole).toHaveBeenCalledWith(1, GlobalRole.student);
    expect(authService.getUserById).toHaveBeenCalledWith(1);
    expect(result).toEqual(response);
  });
});
