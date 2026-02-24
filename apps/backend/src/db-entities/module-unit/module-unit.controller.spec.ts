import { Test } from '@nestjs/testing';
import { ModuleUnitController } from './module-unit.controller';
import { ModuleUnitService } from './module-unit.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { QuestionUnitService } from '../questions/question-unit/question-unit.service';
import { ModuleUnitQuestionGroupService } from '../module-unit-question-group/module-unit-question-group.service';
import type { UpdateModuleUnitDto } from './dto/update-module-unit.dto';

// Unit tests focus on route-to-service forwarding for module-unit controller's exposed routes.
describe('ModuleUnitController.update', () => {
  let controller: ModuleUnitController;
  const service = {
    update: jest.fn(),
  } as unknown as ModuleUnitService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ModuleUnitController],
      providers: [
        { provide: ModuleUnitService, useValue: service },
        { provide: QuestionUnitService, useValue: { findOne: jest.fn() } },
        {
          provide: ModuleUnitQuestionGroupService,
          useValue: { findOne: jest.fn() },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    controller = moduleRef.get(ModuleUnitController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('forwards id and dto', async () => {
    const dto: UpdateModuleUnitDto = { title: 'Updated Unit' };
    const updated = { id: 77, title: 'Updated Unit' };
    (service.update as any).mockResolvedValue(updated);

    const result = await controller.update('77', dto);

    expect(service.update).toHaveBeenCalledWith(77, dto);
    expect(result).toEqual(updated);
  });
});

describe('ModuleUnitController.createForModule', () => {
  let controller: ModuleUnitController;
  const service = {
    createForModule: jest.fn(),
  } as unknown as ModuleUnitService;
  const questionUnitService = {
    findOne: jest.fn(),
  } as unknown as QuestionUnitService;
  const moduleUnitQuestionGroupService = {
    findOne: jest.fn(),
  } as unknown as ModuleUnitQuestionGroupService;

  beforeEach(async () => {
    // Controller unit tests focus on parameter forwarding, not guard internals.
    const moduleRef = await Test.createTestingModule({
      controllers: [ModuleUnitController],
      providers: [
        { provide: ModuleUnitService, useValue: service },
        { provide: QuestionUnitService, useValue: questionUnitService },
        {
          provide: ModuleUnitQuestionGroupService,
          useValue: moduleUnitQuestionGroupService,
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    controller = moduleRef.get(ModuleUnitController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('forwards module id and dto', async () => {
    const dto = { title: 'Algebra' };
    const created = { id: 11, title: 'Algebra' };
    (service.createForModule as any).mockResolvedValue(created);

    const result = await controller.createForModule(5, dto);

    expect(service.createForModule).toHaveBeenCalledWith(5, dto);
    expect(result).toEqual(created);
  });
});

describe('ModuleUnitController.findByModule', () => {
  let controller: ModuleUnitController;
  const service = {
    findByModule: jest.fn(),
  } as unknown as ModuleUnitService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ModuleUnitController],
      providers: [
        { provide: ModuleUnitService, useValue: service },
        { provide: QuestionUnitService, useValue: { findOne: jest.fn() } },
        {
          provide: ModuleUnitQuestionGroupService,
          useValue: { findOne: jest.fn() },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    controller = moduleRef.get(ModuleUnitController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('passes student id to service for student user', async () => {
    const req = { user: { id: 8, globalRole: 'student' } } as any;
    (service.findByModule as any).mockResolvedValue([]);

    await controller.findByModule(12, req);

    expect(service.findByModule).toHaveBeenCalledWith(12, 8);
  });

  it('omits student id for non-student user', async () => {
    const req = { user: { id: 3, globalRole: 'teacher' } } as any;
    (service.findByModule as any).mockResolvedValue([]);

    await controller.findByModule(12, req);

    expect(service.findByModule).toHaveBeenCalledWith(12, undefined);
  });
});

describe('ModuleUnitController.createQuestionGroupForUnit', () => {
  let controller: ModuleUnitController;
  const groupService = {
    createScoped: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ModuleUnitController],
      providers: [
        { provide: ModuleUnitService, useValue: {} },
        { provide: QuestionUnitService, useValue: {} },
        { provide: ModuleUnitQuestionGroupService, useValue: groupService },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    controller = moduleRef.get(ModuleUnitController);
  });

  it('forwards parameters to service', async () => {
    const dto = { moduleUnitId: 3, name: 'Tests', sortOrder: 1 };
    await controller.createQuestionGroupForUnit(2, 3, dto as any);
    expect(groupService.createScoped).toHaveBeenCalledWith(2, 3, dto);
  });
});
