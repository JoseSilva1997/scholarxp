import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserPasswordController } from './user-password.controller';
import { UserPasswordService } from './user-password.service';

describe('UserPasswordController', () => {
  let controller: UserPasswordController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const userId = 21;
  const createDto = { userId, passwordHash: 'hash' };
  const updateDto = { passwordHash: 'updated' };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [UserPasswordController],
      providers: [{ provide: UserPasswordService, useValue: service }],
    }).compile();

    controller = moduleRef.get(UserPasswordController);
  });

  afterEach(() => jest.resetAllMocks());

  it('create forwards DTO to the service', async () => {
    const response = { userId };
    service.create.mockResolvedValue(response);

    const result = await controller.create(createDto);

    expect(service.create).toHaveBeenCalledWith(createDto);
    expect(result).toEqual(response);
  });

  it('findAll delegates to the service', async () => {
    const response = [{ userId }];
    service.findAll.mockResolvedValue(response);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual(response);
  });

  it('findOne parses userId to number and returns service result', async () => {
    const response = { userId };
    service.findOne.mockResolvedValue(response);

    const result = await controller.findOne(String(userId));

    expect(service.findOne).toHaveBeenCalledWith(userId);
    expect(result).toEqual(response);
  });

  it('update parses userId to number and forwards DTO', async () => {
    const response = { userId, ...updateDto };
    service.update.mockResolvedValue(response);

    const result = await controller.update(String(userId), updateDto);

    expect(service.update).toHaveBeenCalledWith(userId, updateDto);
    expect(result).toEqual(response);
  });

  it('remove parses userId to number and delegates', async () => {
    const response = { userId };
    service.remove.mockResolvedValue(response);

    const result = await controller.remove(String(userId));

    expect(service.remove).toHaveBeenCalledWith(userId);
    expect(result).toEqual(response);
  });

  it('propagates service errors', async () => {
    service.findOne.mockRejectedValue(new NotFoundException());

    await expect(controller.findOne(String(userId))).rejects.toThrow(
      NotFoundException,
    );
  });
});
