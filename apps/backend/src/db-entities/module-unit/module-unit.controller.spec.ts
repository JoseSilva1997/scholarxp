import { Test } from '@nestjs/testing';
import { runCrudControllerTests } from '../../test/test-helpers';
import { ModuleUnitController } from './module-unit.controller';
import { ModuleUnitService } from './module-unit.service';
import * as permissions from '../../helpers/permissions.helper';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { QuestionUnitService } from '../questions/question-unit/question-unit.service';

runCrudControllerTests({
  name: 'ModuleUnitController',
  controller: ModuleUnitController,
  service: ModuleUnitService,
  extraProviders: [
    { provide: QuestionUnitService, useValue: { findOne: jest.fn() } },
  ],
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
  const questionUnitService = {
    findOne: jest.fn(),
  } as unknown as QuestionUnitService;

  beforeEach(async () => {
    jest.spyOn(permissions, 'assertHasAccess').mockReturnValue(undefined);
    // Override guards to prevent dependency resolution issues in unit tests.
    // SessionAuthGuard and ModuleAccessGuard have external dependencies we don't need to test here.
    const moduleRef = await Test.createTestingModule({
      controllers: [ModuleUnitController],
      providers: [
        { provide: ModuleUnitService, useValue: service },
        { provide: QuestionUnitService, useValue: questionUnitService },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(ModuleAccessGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
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

    const result = await controller.createForModule('5', dto, req);

    expect(permissions.assertHasAccess).toHaveBeenCalledWith(
      'modules.manageContent',
      mockUser,
    );
    expect(service.createForModule).toHaveBeenCalledWith(5, dto);
    expect(result).toEqual(created);
  });
});
