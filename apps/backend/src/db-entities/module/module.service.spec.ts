// Tests for ModuleService enforcing scoped creation and filtered reads.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { ModuleService } from './module.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';
import { DailyPracticeService } from '../../daily-practice/daily-practice.service';

const teacher = {
  id: 10,
  globalRole: GlobalRole.teacher,
  firstName: 'T',
  lastName: 'E',
  email: 't@example.com',
  profilePictureUrl: '',
  isVerified: true,
};

const admin = { ...teacher, globalRole: GlobalRole.admin };
const instAdmin = { ...teacher, globalRole: GlobalRole.institution_admin };
const student = { ...teacher, globalRole: GlobalRole.student };
const teacherWithInstitution = { ...teacher, hasInstitutionMembership: true };

describe('ModuleService', () => {
  let prisma: PrismaMock;
  let service: ModuleService;
  let dailyPracticeService: Pick<
    DailyPracticeService,
    'getDailyPracticeStatus'
  >;

  beforeEach(() => {
    prisma = createPrismaMock();
    dailyPracticeService = {
      getDailyPracticeStatus: jest.fn(),
    };
    service = new ModuleService(
      prisma,
      dailyPracticeService as DailyPracticeService,
    );
  });

  afterEach(() => jest.resetAllMocks());

  it('creates module with creator id and institution check for teacher', async () => {
    prisma.ltiIdentity.findFirst.mockResolvedValue({ id: 1 } as any);
    const dto = {
      institutionId: 5,
      title: 'Title',
    };
    prisma.module.create.mockResolvedValue({
      id: 1,
      ...dto,
      createdByUserId: teacher.id,
    } as any);

    const result = await service.create(dto as any, teacher as any);

    expect(prisma.ltiIdentity.findFirst).toHaveBeenCalledWith({
      where: { userId: teacher.id, institutionId: 5 },
      select: { id: true },
    });
    expect(prisma.module.create).toHaveBeenCalledWith({
      data: { ...dto, createdByUserId: teacher.id },
    });
    expect(result).toEqual({ id: 1, ...dto, createdByUserId: teacher.id });
  });

  it('rejects institution_admin creation without institutionId', async () => {
    const dto = { title: 'X' };

    await expect(
      service.create(dto as any, instAdmin as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows teacher with institution membership creating non-institution module', async () => {
    const dto = { title: 'Nope' };
    prisma.module.create.mockResolvedValue({
      id: 77,
      ...dto,
      createdByUserId: teacherWithInstitution.id,
    } as any);

    const result = await service.create(
      dto as any,
      teacherWithInstitution as any,
    );

    expect(prisma.module.create).toHaveBeenCalledWith({
      data: { ...dto, createdByUserId: teacherWithInstitution.id },
    });
    expect(result).toEqual({
      id: 77,
      ...dto,
      createdByUserId: teacherWithInstitution.id,
    });
  });

  it('findAll returns all for admin', async () => {
    prisma.module.findMany.mockResolvedValue([{ id: 1 }] as any);

    const result = await service.findAll(admin as any);

    expect(result).toEqual([{ id: 1 }]);
    expect(prisma.module.findMany).toHaveBeenCalledWith({ where: {} });
  });

  it('findAll filters for student membership', async () => {
    prisma.module.findMany.mockResolvedValue([{ id: 2 }] as any);

    const result = await service.findAll(student as any);

    expect(prisma.module.findMany).toHaveBeenCalledWith({
      where: {
        userModules: { some: { userId: student.id, roleInModule: 'student' } },
      },
    });
    expect(result).toEqual([{ id: 2 }]);
  });

  it('update checks institution membership for institution_admin', async () => {
    prisma.module.findUnique.mockResolvedValue({ id: 9 } as any);
    prisma.ltiIdentity.findFirst.mockResolvedValue({ id: 1 } as any);
    prisma.module.update.mockResolvedValue({ id: 9, title: 'New' } as any);

    const result = await service.update(
      9,
      { institutionId: 3, title: 'New' } as any,
      instAdmin as any,
    );

    expect(prisma.ltiIdentity.findFirst).toHaveBeenCalledWith({
      where: { userId: instAdmin.id, institutionId: 3 },
      select: { id: true },
    });
    expect(result).toEqual({ id: 9, title: 'New' });
  });

  it('getOrThrow throws when missing', async () => {
    prisma.module.findUnique.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne returns module with student progress when enrolled', async () => {
    prisma.module.findUnique.mockResolvedValue({ id: 7 } as any);
    prisma.userModule.findUnique.mockResolvedValue({
      userModuleLevel: 3,
      currentExp: 120,
    } as any);
    (
      dailyPracticeService.getDailyPracticeStatus as jest.Mock
    ).mockResolvedValue({
      status: 'available',
      progress: {
        totalQuestions: 4,
        answeredQuestions: 0,
        completedAt: null,
      },
    });

    const result = await service.findOne(7, student as any);

    expect(prisma.userModule.findUnique).toHaveBeenCalledWith({
      where: { moduleId_userId: { moduleId: 7, userId: student.id } },
      select: { userModuleLevel: true, currentExp: true },
    });
    expect(dailyPracticeService.getDailyPracticeStatus).toHaveBeenCalledWith(
      7,
      student.id,
    );
    expect(result).toEqual({
      id: 7,
      userModuleLevel: 3,
      currentExp: 120,
      dailyPractice: {
        status: 'available',
        progress: {
          totalQuestions: 4,
          answeredQuestions: 0,
          completedAt: null,
        },
      },
    });
  });

  it('findOne skips progress lookup for non-students', async () => {
    prisma.module.findUnique.mockResolvedValue({ id: 8 } as any);

    const result = await service.findOne(8, teacher as any);

    expect(prisma.userModule.findUnique).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 8 });
  });
});
