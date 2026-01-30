// Controller tests verify DTO forwarding and moduleId propagation for roster reads.
import { Test, TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import { UserModuleController } from './user-module.controller';
import { UserModuleService } from './user-module.service';

describe('UserModuleController', () => {
  let controller: UserModuleController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const req: any = {
    user: { id: 1, globalRole: GlobalRole.teacher },
    query: { moduleId: '5' },
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserModuleController],
      providers: [{ provide: UserModuleService, useValue: service }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(ModuleAccessGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(UserModuleController);
  });

  afterEach(() => jest.resetAllMocks());

  it('create forwards payload and user', async () => {
    const dto = { moduleId: 5, userId: 2 };
    service.create.mockResolvedValue({ id: 1 });

    const result = await controller.create(dto as any, req);

    expect(service.create).toHaveBeenCalledWith(dto, req.user);
    expect(result).toEqual({ id: 1 });
  });

  it('findAll forwards parsed moduleId', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll(req);

    expect(service.findAll).toHaveBeenCalledWith(5, req.user);
  });

  it('findOne delegates to service', async () => {
    service.findOne.mockResolvedValue({ id: 9 });

    const result = await controller.findOne('9');

    expect(service.findOne).toHaveBeenCalledWith(9);
    expect(result).toEqual({ id: 9 });
  });

  it('update forwards payload and user', async () => {
    const dto = { roleInModule: 'teacher' };
    service.update.mockResolvedValue({ id: 2 });

    const result = await controller.update('2', dto as any, req);

    expect(service.update).toHaveBeenCalledWith(2, dto, req.user);
    expect(result).toEqual({ id: 2 });
  });

  it('remove forwards user', async () => {
    service.remove.mockResolvedValue({ id: 3 });

    const result = await controller.remove('3', req);

    expect(service.remove).toHaveBeenCalledWith(3, req.user);
    expect(result).toEqual({ id: 3 });
  });
});
