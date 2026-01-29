// Controller tests ensure DTO forwarding while bypassing guards.
import { Test, TestingModule } from '@nestjs/testing';
import { ModuleInviteController } from './module-invite.controller';
import { ModuleInviteService } from './module-invite.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';

describe('ModuleInviteController', () => {
  let controller: ModuleInviteController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
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
      controllers: [ModuleInviteController],
      providers: [{ provide: ModuleInviteService, useValue: service }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(ModuleAccessGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(ModuleInviteController);
  });

  afterEach(() => jest.resetAllMocks());

  it('create forwards DTO to the service', async () => {
    const dto: any = {
      moduleId: 1,
      createdByUserId: 2,
      type: 'link',
      tokenHash: 'h',
    };
    service.create.mockResolvedValue({ id: 1 });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 1 });
  });

  it('findAll delegates to the service', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('findOne parses id to number and returns service result', async () => {
    service.findOne.mockResolvedValue({ id: 3 });

    const result = await controller.findOne('3');

    expect(service.findOne).toHaveBeenCalledWith(3);
    expect(result).toEqual({ id: 3 });
  });

  it('update parses id to number and forwards DTO', async () => {
    const dto: any = { maxUses: 5 };
    service.update.mockResolvedValue({ id: 4 });

    const result = await controller.update('4', dto);

    expect(service.update).toHaveBeenCalledWith(4, dto);
    expect(result).toEqual({ id: 4 });
  });

  it('remove parses id to number and delegates', async () => {
    service.remove.mockResolvedValue({ id: 5 });

    const result = await controller.remove('5');

    expect(service.remove).toHaveBeenCalledWith(5);
    expect(result).toEqual({ id: 5 });
  });

  it('propagates service errors', async () => {
    service.create.mockRejectedValue(new Error('boom'));

    await expect(controller.create({} as any)).rejects.toThrow('boom');
  });
});
