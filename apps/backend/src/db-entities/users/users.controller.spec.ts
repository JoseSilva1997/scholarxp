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
    updateName: jest.fn(),
    updateProfilePicture: jest.fn(),
    removeProfilePicture: jest.fn(),
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

  it('forwards name updates and returns refreshed auth payload', async () => {
    const refreshed = { id: 1, firstName: 'New', lastName: 'Name' };
    service.updateName.mockResolvedValue({ id: 1 });
    authService.getUserById.mockResolvedValue(refreshed);

    const result = await controller.updateName(1, {
      firstName: 'New',
      lastName: 'Name',
    } as any);

    expect(service.updateName).toHaveBeenCalledWith(1, 'New', 'Name');
    expect(authService.getUserById).toHaveBeenCalledWith(1);
    expect(result).toEqual(refreshed);
  });

  it('forwards profile-picture uploads and returns refreshed auth payload', async () => {
    const file = {
      buffer: Buffer.from(''),
      mimetype: 'image/png',
      size: 1,
    } as any;
    const refreshed = { id: 1, profilePictureUrl: 'https://cdn/x.png' };
    service.updateProfilePicture.mockResolvedValue({ id: 1 });
    authService.getUserById.mockResolvedValue(refreshed);

    const result = await controller.updateProfilePicture(1, file);

    expect(service.updateProfilePicture).toHaveBeenCalledWith(1, file);
    expect(authService.getUserById).toHaveBeenCalledWith(1);
    expect(result).toEqual(refreshed);
  });

  it('forwards profile-picture deletion and returns refreshed auth payload', async () => {
    const refreshed = { id: 1, profilePictureUrl: 'default-profile-pic.png' };
    service.removeProfilePicture.mockResolvedValue({ id: 1 });
    authService.getUserById.mockResolvedValue(refreshed);

    const result = await controller.removeProfilePicture(1);

    expect(service.removeProfilePicture).toHaveBeenCalledWith(1);
    expect(authService.getUserById).toHaveBeenCalledWith(1);
    expect(result).toEqual(refreshed);
  });
});
