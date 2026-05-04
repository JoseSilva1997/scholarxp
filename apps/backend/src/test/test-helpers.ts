// Provides reusable NestJS unit-test helpers for CRUD services and controllers,
// keeping entity-specific spec files focused on fixtures and expected behaviour.
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';

export type PrismaMock = DeepMockProxy<PrismaService>;

// Creates a deep Prisma mock so service tests can exercise the Repository pattern
// through Prisma model delegates without connecting to a real database.
export const createPrismaMock = (_modelName?: string, _methods?: string[]) =>
  mockDeep<PrismaService>();

// Describes the inputs required to generate a consistent CRUD service test suite.
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

// Generates standard CRUD service tests for services that wrap Prisma model delegates.
export function runCrudServiceTests<TCreate, TUpdate>(
  config: CrudServiceTestConfig<TCreate, TUpdate>,
) {
  // Groups the generated tests under the consuming service name for readable Jest output.
  describe(config.name, () => {
    let prisma: PrismaMock;
    let moduleRef: TestingModule;
    let service: any;

    // Allows services to transform DTOs before persistence while preserving a simple default path.
    const toCreateData = (dto: TCreate) =>
      config.formatCreateData ? config.formatCreateData(dto) : dto;
    // Mirrors create mapping for update payloads, because partial updates often have different shapes.
    const toUpdateData = (dto: TUpdate) =>
      config.formatUpdateData ? config.formatUpdateData(dto) : dto;

    const id = 42;
    // Allow feature services to provide a realistic persisted record when update logic
    // depends on domain-specific fields instead of a generic `{ id, name }` shape.
    const existing = config.existingRecord ?? {
      id,
      name: `${config.entityLabel}-${id}`,
    };

    // Builds an isolated Nest testing module so each generated test receives fresh mocks.
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

    // Clears mock history between generated scenarios to keep assertions independent.
    afterEach(() => {
      jest.resetAllMocks();
    });

    // Verifies that service creation delegates to the correct Prisma model with mapped data.
    it('create forwards DTO to Prisma model', async () => {
      const created = { id, ...config.createDto };
      (prisma as any)[config.modelName].create.mockResolvedValue(created);

      const result = await service.create(config.createDto);

      expect((prisma as any)[config.modelName].create).toHaveBeenCalledWith({
        data: toCreateData(config.createDto),
      });
      expect(result).toEqual(created);
    });

    // Confirms list operations remain a direct repository read without hidden filtering.
    it('findAll delegates to Prisma model', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      (prisma as any)[config.modelName].findMany.mockResolvedValue(rows);

      const result = await service.findAll();

      expect((prisma as any)[config.modelName].findMany).toHaveBeenCalledWith();
      expect(result).toEqual(rows);
    });

    // Confirms single-record reads use the configured identifier contract.
    it('findOne returns the record when found', async () => {
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(existing);

      const result = await service.findOne(id);

      expect((prisma as any)[config.modelName].findUnique).toHaveBeenCalledWith(
        { where: { id } },
      );
      expect(result).toEqual(existing);
    });

    // Ensures missing records are translated into the HTTP-aware domain error expected by controllers.
    it('findOne throws NotFoundException when record is missing', async () => {
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(null);

      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
      expect((prisma as any)[config.modelName].findUnique).toHaveBeenCalledWith(
        { where: { id } },
      );
    });

    // Verifies the service protects updates by checking existence before writing.
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

    // Confirms update does not create or modify records when the target row is absent.
    it('update rethrows NotFoundException when missing', async () => {
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(null);

      await expect(service.update(id, config.updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect((prisma as any)[config.modelName].update).not.toHaveBeenCalled();
    });

    // Verifies deletes follow the same existence-first contract as updates.
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

    // Confirms missing records do not trigger a Prisma delete call.
    it('remove rethrows NotFoundException when missing', async () => {
      (prisma as any)[config.modelName].findUnique.mockResolvedValue(null);

      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
      expect((prisma as any)[config.modelName].delete).not.toHaveBeenCalled();
    });
  });
}

// Describes the controller and service pair required to generate CRUD controller tests.
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

// Generates standard controller tests for Nest controllers that delegate CRUD work to a service layer.
export function runCrudControllerTests<TCreate, TUpdate>(
  config: CrudControllerTestConfig<TCreate, TUpdate>,
) {
  // Groups generated controller tests under the consuming controller name for readable Jest output.
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
    // Keeps the default controller contract numeric while allowing string identifiers where needed.
    const parseId = config.parseId ?? ((id: string) => Number(id));

    // Builds an isolated controller module with a mocked service dependency.
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

    // Clears service mock calls so generated controller scenarios do not influence each other.
    afterEach(() => jest.resetAllMocks());

    // Verifies controller creation routes request DTOs to the service layer unchanged.
    it('create forwards DTO to the service', async () => {
      const response = config.sampleResponse ?? { id: 1, ...config.createDto };
      service.create.mockResolvedValue(response);

      const result = await controller.create(config.createDto);

      expect(service.create).toHaveBeenCalledWith(config.createDto);
      expect(result).toEqual(response);
    });

    // Confirms the controller does not add query behaviour around a simple list request.
    it('findAll delegates to the service', async () => {
      const response = [{ id: 1 }];
      service.findAll.mockResolvedValue(response);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(response);
    });

    // Verifies route parameters are normalised before reaching the service boundary.
    it('findOne parses id and returns service result', async () => {
      const response = { id: baseId };
      service.findOne.mockResolvedValue(response);

      const result = await controller.findOne(String(baseId));

      expect(service.findOne).toHaveBeenCalledWith(parseId(String(baseId)));
      expect(result).toEqual(response);
    });

    // Confirms update requests combine parsed route identifiers with the original body DTO.
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

    // Verifies delete-style controller methods delegate by parsed identifier only.
    it('remove parses id and delegates', async () => {
      const response = { id: baseId };
      service.remove.mockResolvedValue(response);

      const result = await controller.remove(String(baseId));

      expect(service.remove).toHaveBeenCalledWith(parseId(String(baseId)));
      expect(result).toEqual(response);
    });

    // Ensures controller tests preserve service-layer exceptions instead of masking them.
    it('propagates service errors', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(String(baseId))).rejects.toThrow(
        NotFoundException,
      );
    });
  });
}
