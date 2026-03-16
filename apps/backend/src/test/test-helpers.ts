import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';

export type PrismaMock = DeepMockProxy<PrismaService>;

export const createPrismaMock = (_modelName?: string, _methods?: string[]) =>
  mockDeep<PrismaService>();

interface CrudServiceTestConfig<TCreate, TUpdate> {
  name: string;
  service: new (...args: any[]) => any;
  modelName: string;
  entityLabel: string;
  createDto: TCreate;
  updateDto: TUpdate;
  existingRecord?: any;
  formatCreateData?: (dto: TCreate) => any;
  formatUpdateData?: (dto: TUpdate) => any;
}

export function runCrudServiceTests<TCreate, TUpdate>(
  config: CrudServiceTestConfig<TCreate, TUpdate>,
) {
  describe(config.name, () => {
    let prisma: PrismaMock;
    let moduleRef: TestingModule;
    let service: any;

    const toCreateData = (dto: TCreate) =>
      config.formatCreateData ? config.formatCreateData(dto) : dto;
    const toUpdateData = (dto: TUpdate) =>
      config.formatUpdateData ? config.formatUpdateData(dto) : dto;

    const id = 42;
    // Allow feature services to provide a realistic persisted record when update logic
    // depends on domain-specific fields instead of a generic `{ id, name }` shape.
    const existing = config.existingRecord ?? {
      id,
      name: `${config.entityLabel}-${id}`,
    };

    beforeEach(async () => {
      prisma = createPrismaMock(config.modelName);
      moduleRef = await Test.createTestingModule({
        providers: [
          config.service,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      service = moduleRef.get(config.service);
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('create forwards DTO to Prisma model', async () => {
      const created = { id, ...config.createDto };
      (prisma as any)[config.modelName].create.mockResolvedValue(created);

      const result = await service.create(config.createDto);

      expect((prisma as any)[config.modelName].create).toHaveBeenCalledWith({
        data: toCreateData(config.createDto),
      });
      expect(result).toEqual(created);
    });

    it('findAll delegates to Prisma model', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      (prisma as any)[config.modelName].findMany.mockResolvedValue(rows);

      const result = await service.findAll();

      expect((prisma as any)[config.modelName].findMany).toHaveBeenCalledWith();
      expect(result).toEqual(rows);
    });

    it('findOne returns the record when found', async () => {
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(existing);

      const result = await service.findOne(id);

      expect((prisma as any)[config.modelName].findUnique).toHaveBeenCalledWith(
        { where: { id } },
      );
      expect(result).toEqual(existing);
    });

    it('findOne throws NotFoundException when record is missing', async () => {
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(null);

      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
      expect((prisma as any)[config.modelName].findUnique).toHaveBeenCalledWith(
        { where: { id } },
      );
    });

    it('update checks existence then updates with DTO', async () => {
      const updated = { id, ...config.updateDto };
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(existing);
      (prisma as any)[config.modelName].update.mockResolvedValue(updated);

      const result = await service.update(id, config.updateDto);

      expect((prisma as any)[config.modelName].findUnique).toHaveBeenCalledWith(
        { where: { id } },
      );
      expect((prisma as any)[config.modelName].update).toHaveBeenCalledWith({
        where: { id },
        data: toUpdateData(config.updateDto),
      });
      expect(result).toEqual(updated);
    });

    it('update rethrows NotFoundException when missing', async () => {
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(null);

      await expect(service.update(id, config.updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect((prisma as any)[config.modelName].update).not.toHaveBeenCalled();
    });

    it('remove checks existence then deletes', async () => {
      const removed = { id };
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(existing);
      (prisma as any)[config.modelName].delete.mockResolvedValue(removed);

      const result = await service.remove(id);

      expect((prisma as any)[config.modelName].findUnique).toHaveBeenCalledWith(
        { where: { id } },
      );
      expect((prisma as any)[config.modelName].delete).toHaveBeenCalledWith({
        where: { id },
      });
      expect(result).toEqual(removed);
    });

    it('remove rethrows NotFoundException when missing', async () => {
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(null);

      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
      expect((prisma as any)[config.modelName].delete).not.toHaveBeenCalled();
    });
  });
}

interface CrudControllerTestConfig<TCreate, TUpdate> {
  name: string;
  controller: new (...args: any[]) => any;
  service: new (...args: any[]) => any;
  createDto: TCreate;
  updateDto: TUpdate;
  sampleResponse?: any;
  baseId?: number | string;
  parseId?: (id: string) => unknown;
  extraProviders?: any[];
}

export function runCrudControllerTests<TCreate, TUpdate>(
  config: CrudControllerTestConfig<TCreate, TUpdate>,
) {
  describe(config.name, () => {
    let controller: any;
    let service: {
      create: jest.Mock;
      findAll: jest.Mock;
      findOne: jest.Mock;
      update: jest.Mock;
      remove: jest.Mock;
    };

    const baseId = config.baseId ?? 21;
    const parseId = config.parseId ?? ((id: string) => Number(id));

    beforeEach(async () => {
      service = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      };

      // Create a testing module with guard overrides to prevent dependency resolution issues.
      // Controller unit tests isolate parameter forwarding and should not instantiate auth guard dependencies.
      const moduleRef = await Test.createTestingModule({
        controllers: [config.controller],
        providers: [
          { provide: config.service, useValue: service },
          ...(config.extraProviders ?? []),
        ],
      })
        .overrideGuard(AuthorizationGuard)
        .useValue({ canActivate: jest.fn().mockReturnValue(true) })
        .compile();

      controller = moduleRef.get(config.controller);
    });

    afterEach(() => jest.resetAllMocks());

    it('create forwards DTO to the service', async () => {
      const response = config.sampleResponse ?? { id: 1, ...config.createDto };
      service.create.mockResolvedValue(response);

      const result = await controller.create(config.createDto);

      expect(service.create).toHaveBeenCalledWith(config.createDto);
      expect(result).toEqual(response);
    });

    it('findAll delegates to the service', async () => {
      const response = [{ id: 1 }];
      service.findAll.mockResolvedValue(response);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(response);
    });

    it('findOne parses id and returns service result', async () => {
      const response = { id: baseId };
      service.findOne.mockResolvedValue(response);

      const result = await controller.findOne(String(baseId));

      expect(service.findOne).toHaveBeenCalledWith(parseId(String(baseId)));
      expect(result).toEqual(response);
    });

    it('update parses id and forwards DTO', async () => {
      const response = { id: baseId, ...config.updateDto };
      service.update.mockResolvedValue(response);

      const result = await controller.update(String(baseId), config.updateDto);

      expect(service.update).toHaveBeenCalledWith(
        parseId(String(baseId)),
        config.updateDto,
      );
      expect(result).toEqual(response);
    });

    it('remove parses id and delegates', async () => {
      const response = { id: baseId };
      service.remove.mockResolvedValue(response);

      const result = await controller.remove(String(baseId));

      expect(service.remove).toHaveBeenCalledWith(parseId(String(baseId)));
      expect(result).toEqual(response);
    });

    it('propagates service errors', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(String(baseId))).rejects.toThrow(
        NotFoundException,
      );
    });
  });
}
