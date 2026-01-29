// Controller tests ensure DTOs are forwarded with auth context to the service.
import { Test, TestingModule } from '@nestjs/testing';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';
import { GlobalRole } from '@prisma/client';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';

describe('ModuleController', () => {
  let controller: ModuleController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const req = {
    user: { id: 1, globalRole: GlobalRole.teacher } as any,
  } as any;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ModuleController],
      providers: [{ provide: ModuleService, useValue: service }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(ModuleAccessGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(ModuleController);
  });

  afterEach(() => jest.resetAllMocks());

  it('create forwards dto and user', async () => {
    const dto = { title: 'X', variantContext: 'vc' } as any;
    const expected = { id: 10 };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(dto, req);

    expect(service.create).toHaveBeenCalledWith(dto, req.user);
    expect(result).toEqual(expected);
  });

  it('findAll forwards user', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await controller.findAll(req);

    expect(service.findAll).toHaveBeenCalledWith(req.user);
    expect(result).toEqual([]);
  });

  it('findOne delegates to service', async () => {
    service.findOne.mockResolvedValue({ id: 1 });

    const result = await controller.findOne('1');

    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1 });
  });

  it('update forwards dto and user', async () => {
    const dto = { title: 'New' } as any;
    service.update.mockResolvedValue({ id: 2 });

    const result = await controller.update('2', dto, req);

    expect(service.update).toHaveBeenCalledWith(2, dto, req.user);
    expect(result).toEqual({ id: 2 });
  });

  it('remove delegates to service', async () => {
    service.remove.mockResolvedValue({ id: 3 });

    const result = await controller.remove('3');

    expect(service.remove).toHaveBeenCalledWith(3);
    expect(result).toEqual({ id: 3 });
  });
});
