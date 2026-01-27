import { Test, TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';

// Verifies that role updates use the dedicated endpoint while profile edits stay side-effect free.
describe('UsersController', () => {
  let controller: UsersController;
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateRole: jest.fn(),
    remove: jest.fn(),
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
    }).compile();

    controller = module.get(UsersController);
    jest.clearAllMocks();
  });

  it('forwards role updates to updateRole via /:id/role', async () => {
    const response = { id: 1, globalRole: GlobalRole.student, avatar: null };
    service.updateRole.mockResolvedValue({ id: 1 });
    authService.getUserById.mockResolvedValue(response);

    const result = await controller.updateRole('1', {
      globalRole: GlobalRole.student,
    } as any);

    expect(service.updateRole).toHaveBeenCalledWith(1, GlobalRole.student);
    expect(authService.getUserById).toHaveBeenCalledWith(1);
    expect(result).toEqual(response);
  });

  it('rejects role changes sent to the generic update route', () => {
    expect(() =>
      controller.update('1', { globalRole: GlobalRole.student } as any),
    ).toThrow(BadRequestException);
    expect(service.updateRole).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('forwards non-role updates to update via /:id', async () => {
    const dto = { firstName: 'Updated' };
    const response = { id: 1, ...dto };
    service.update.mockResolvedValue(response);

    const result = await controller.update('1', dto as any);

    expect(service.update).toHaveBeenCalledWith(1, dto);
    expect(service.updateRole).not.toHaveBeenCalled();
    expect(result).toEqual(response);
  });
});
