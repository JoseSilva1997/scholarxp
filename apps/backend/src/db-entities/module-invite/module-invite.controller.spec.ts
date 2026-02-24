// Controller tests ensure DTO forwarding while bypassing guards.
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ModuleInviteController } from './module-invite.controller';
import { ModuleInviteService } from './module-invite.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { GlobalRole } from '@prisma/client';
import { CreateModuleInviteDto } from './dto/create-module-invite.dto';
import { UpdateModuleInviteDto } from './dto/update-module-invite.dto';
import { RedeemModuleInviteDto } from './dto/redeem-module-invite.dto';

describe('ModuleInviteController', () => {
  let controller: ModuleInviteController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    redeem: jest.Mock;
  };
  const req = {
    user: { id: 1, globalRole: GlobalRole.teacher },
  } as unknown as Request;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      redeem: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ModuleInviteController],
      providers: [{ provide: ModuleInviteService, useValue: service }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(ModuleInviteController);
  });

  afterEach(() => jest.resetAllMocks());

  it('create forwards DTO to the service', async () => {
    const dto: CreateModuleInviteDto = { maxUses: 50 };
    service.create.mockResolvedValue({ invite: { id: 1 } });

    const result = await controller.create(9, dto, req);

    expect(service.create).toHaveBeenCalledWith(9, dto, req.user);
    expect(result).toEqual({ invite: { id: 1 } });
  });

  it('findAll delegates to the service', async () => {
    service.findAll.mockResolvedValue([{ id: 2 }]);

    const result = await controller.findAll(3);

    expect(service.findAll).toHaveBeenCalledWith(3);
    expect(result).toEqual([{ id: 2 }]);
  });

  it('update parses id to number and forwards DTO', async () => {
    const dto: UpdateModuleInviteDto = { maxUses: 5 };
    service.update.mockResolvedValue({ id: 4 });

    const result = await controller.update(7, 4, dto);

    expect(service.update).toHaveBeenCalledWith(7, 4, dto);
    expect(result).toEqual({ id: 4 });
  });

  it('remove parses id to number and delegates', async () => {
    service.remove.mockResolvedValue({ id: 5 });

    const result = await controller.remove(11, 5);

    expect(service.remove).toHaveBeenCalledWith(11, 5);
    expect(result).toEqual({ id: 5 });
  });

  it('redeem forwards token to service', async () => {
    const dto: RedeemModuleInviteDto = { token: 'abc' };
    service.redeem.mockResolvedValue({ moduleId: 9 });

    const result = await controller.redeem(dto, req);

    expect(service.redeem).toHaveBeenCalledWith(dto, req.user);
    expect(result).toEqual({ moduleId: 9 });
  });

  it('propagates service errors', async () => {
    service.create.mockRejectedValue(new Error('boom'));

    await expect(controller.create(1, {} as any, req)).rejects.toThrow(
      'boom',
    );
  });
});
