import { Test } from '@nestjs/testing';
import { runCrudControllerTests } from '../../test/test-helpers';
import { ModuleUnitController } from './module-unit.controller';
import { ModuleUnitService } from './module-unit.service';
import * as permissions from '../../helpers/permissions.helper';

runCrudControllerTests({
  name: 'ModuleUnitController',
  controller: ModuleUnitController,
  service: ModuleUnitService,
  createDto: {
    moduleId: 1,
    variantContext: 'ctx',
    title: 'Unit 1',
    questionCount: 3,
    status: 'draft' as any,
    sortOrder: 1,
  },
  updateDto: {
    title: 'Updated Unit',
  },
});

describe('ModuleUnitController.createForModule', () => {
  let controller: ModuleUnitController;
  const service = {
    createForModule: jest.fn(),
  } as unknown as ModuleUnitService;

  beforeEach(async () => {
    jest.spyOn(permissions, 'assertHasAccess').mockReturnValue(undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [ModuleUnitController],
      providers: [{ provide: ModuleUnitService, useValue: service }],
    }).compile();
    controller = moduleRef.get(ModuleUnitController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('forwards module id, dto, and enforces permissions', async () => {
    const mockUser = { id: 1 } as any;
    const req: any = { user: mockUser };
    const dto = { title: 'Algebra' };
    const created = { id: 11, title: 'Algebra' };
    (service.createForModule as any).mockResolvedValue(created);

    const result = await controller.createForModule('5', dto, req as any);

    expect(permissions.assertHasAccess).toHaveBeenCalledWith(
      'modules.manageContent',
      mockUser,
    );
    expect(service.createForModule).toHaveBeenCalledWith(5, dto);
    expect(result).toEqual(created);
  });
});
