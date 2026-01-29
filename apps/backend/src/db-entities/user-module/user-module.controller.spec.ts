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

  it('create forwards payload', async () => {
    const dto = { moduleId: 5, userId: 2 };
    service.create.mockResolvedValue({ id: 1 });

    const result = await controller.create(dto as any);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 1 });
  });

  it('findAll forwards parsed moduleId', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll(req);

    expect(service.findAll).toHaveBeenCalledWith(5);
  });

  it('findOne delegates to service', async () => {
    service.findOne.mockResolvedValue({ id: 9 });

    const result = await controller.findOne('9');

    expect(service.findOne).toHaveBeenCalledWith(9);
    expect(result).toEqual({ id: 9 });
  });
});
