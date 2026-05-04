// Verifies RosterController forwards module-scoped route and query data to RosterService.
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';

describe('RosterController', () => {
  let controller: RosterController;
  let rosterService: {
    getSummary: jest.Mock;
    getStudents: jest.Mock;
    getLessons: jest.Mock;
    getStudentDetail: jest.Mock;
    removeStudent: jest.Mock;
    getLessonDrilldown: jest.Mock;
  };

  beforeEach(async () => {
    rosterService = {
      getSummary: jest.fn(),
      getStudents: jest.fn(),
      getLessons: jest.fn(),
      getStudentDetail: jest.fn(),
      removeStudent: jest.fn(),
      getLessonDrilldown: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RosterController],
      providers: [{ provide: RosterService, useValue: rosterService }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(RosterController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('forwards summary requests by module id', async () => {
    const response = { studentsEnrolled: 3 };
    rosterService.getSummary.mockResolvedValue(response);

    const result = await controller.getSummary({ moduleId: 2 });

    expect(rosterService.getSummary).toHaveBeenCalledWith(2);
    expect(result).toBe(response);
  });

  it('forwards students list queries by module id', async () => {
    const query = { search: 'ada', sort: 'name' };
    const response = { rows: [] };
    rosterService.getStudents.mockResolvedValue(response);

    const result = await controller.getStudents({ moduleId: 2 }, query);

    expect(rosterService.getStudents).toHaveBeenCalledWith(2, query);
    expect(result).toBe(response);
  });

  it('forwards lesson list queries by module id', async () => {
    const query = { status: 'live' };
    const response = { rows: [] };
    rosterService.getLessons.mockResolvedValue(response);

    const result = await controller.getLessons({ moduleId: 2 }, query);

    expect(rosterService.getLessons).toHaveBeenCalledWith(2, query);
    expect(result).toBe(response);
  });

  it('forwards student drilldown route params', async () => {
    const response = { studentId: 4 };
    rosterService.getStudentDetail.mockResolvedValue(response);

    const result = await controller.getStudentDetail({
      moduleId: 2,
      studentId: 4,
    });

    expect(rosterService.getStudentDetail).toHaveBeenCalledWith(2, 4);
    expect(result).toBe(response);
  });

  it('forwards remove-student requests with requester id', async () => {
    const response = { removed: true };
    rosterService.removeStudent.mockResolvedValue(response);

    const result = await controller.removeStudent(
      { moduleId: 2, studentId: 4 },
      { user: { id: 9 } } as never,
    );

    expect(rosterService.removeStudent).toHaveBeenCalledWith(2, 4, 9);
    expect(result).toBe(response);
  });

  it('forwards lesson drilldown route params', async () => {
    const response = { moduleUnitId: 6 };
    rosterService.getLessonDrilldown.mockResolvedValue(response);

    const result = await controller.getLessonDrilldown({
      moduleId: 2,
      moduleUnitId: 6,
    });

    expect(rosterService.getLessonDrilldown).toHaveBeenCalledWith(2, 6);
    expect(result).toBe(response);
  });
});
