// Tests for ModuleService enforcing creator ownership, membership scoping, and archive behavior.
import { NotFoundException } from '@nestjs/common';
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
const student = { ...teacher, globalRole: GlobalRole.student };

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

  it('creates module with creator id for teacher', async () => {
    const dto = {
      title: 'Title',
    };
    prisma.module.create.mockResolvedValue({
      id: 1,
      ...dto,
      createdByUserId: teacher.id,
    } as any);

    const result = await service.create(dto as any, teacher as any);

    expect(prisma.module.create).toHaveBeenCalledWith({
      data: { ...dto, createdByUserId: teacher.id },
    });
    expect(result).toEqual({ id: 1, ...dto, createdByUserId: teacher.id });
  });

  it('allows teacher to create a module without external scope', async () => {
    const dto = { title: 'Nope' };
    prisma.module.create.mockResolvedValue({
      id: 77,
      ...dto,
      createdByUserId: teacher.id,
    } as any);

    const result = await service.create(dto as any, teacher as any);

    expect(prisma.module.create).toHaveBeenCalledWith({
      data: { ...dto, createdByUserId: teacher.id },
    });
    expect(result).toEqual({
      id: 77,
      ...dto,
      createdByUserId: teacher.id,
    });
  });

  it('findAll returns all for admin with author name resolved', async () => {
    prisma.module.findMany.mockResolvedValue([
      { id: 1, createdBy: { firstName: 'Ada', lastName: 'Lovelace' } },
    ] as any);

    const result = await service.findAll(admin as any);

    expect(result).toEqual([{ id: 1, createdByName: 'Ada Lovelace' }]);
    expect(prisma.module.findMany).toHaveBeenCalledWith({
      where: { archivedAt: null },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
  });

  it('findAll filters for student membership and falls back when author is missing', async () => {
    prisma.module.findMany.mockResolvedValue([
      { id: 2, createdBy: null },
    ] as any);

    const result = await service.findAll(student as any);

    expect(prisma.module.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            userModules: {
              some: { userId: student.id, roleInModule: 'student' },
            },
          },
          { archivedAt: null },
        ],
      },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    expect(result).toEqual([{ id: 2, createdByName: null }]);
  });

  it('updates module fields after confirming the module exists', async () => {
    prisma.module.findUnique.mockResolvedValue({ id: 9 } as any);
    prisma.module.update.mockResolvedValue({ id: 9, title: 'New' } as any);

    const result = await service.update(
      9,
      { title: 'New' } as any,
      teacher as any,
    );

    expect(prisma.module.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { title: 'New' },
    });
    expect(result).toEqual({ id: 9, title: 'New' });
  });

  it('getOrThrow throws when missing', async () => {
    prisma.module.findUnique.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne treats archived modules as not found', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 99,
      archivedAt: new Date('2026-04-01T00:00:00.000Z'),
    } as any);

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

  it('archives modules instead of deleting them', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 4,
      archivedAt: null,
    } as any);
    prisma.module.update.mockResolvedValue({
      id: 4,
      archivedAt: new Date('2026-04-25T12:00:00.000Z'),
    } as any);

    const result = await service.remove(4, teacher as any);

    expect(prisma.module.delete).not.toHaveBeenCalled();
    expect(prisma.module.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { archivedAt: expect.any(Date) },
    });
    expect(result).toEqual({
      id: 4,
      archivedAt: new Date('2026-04-25T12:00:00.000Z'),
    });
  });

  it('returns an already archived module when remove is repeated', async () => {
    const archivedAt = new Date('2026-04-01T00:00:00.000Z');
    prisma.module.findUnique.mockResolvedValue({ id: 4, archivedAt } as any);

    const result = await service.remove(4, teacher as any);

    expect(prisma.module.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 4, archivedAt });
  });

  it('returns deletion impact counts and purge eligibility', async () => {
    const archivedAt = new Date('2026-03-01T00:00:00.000Z');
    prisma.module.findUnique
      .mockResolvedValueOnce({ id: 4, archivedAt } as any)
      .mockResolvedValueOnce({ archivedAt } as any);
    mockImpactCounts(prisma, {
      studentEnrollments: 0,
      attempts: 0,
      expLedgerEntries: 0,
      moduleUnitProgress: 0,
      studentQuestionStates: 0,
      dailyPracticeSets: 0,
      dailyPracticeSetItems: 0,
      dailyQuests: 0,
      invites: 2,
      moduleUnits: 3,
      questions: 12,
    });

    const result = await service.getDeletionImpact(
      4,
      new Date('2026-04-25T00:00:00.000Z'),
    );

    expect(result).toEqual({
      moduleId: 4,
      isArchived: true,
      willArchive: true,
      isPurgeableArchivedModule: true,
      purgeEligibleAt: '2026-03-31T00:00:00.000Z',
      counts: {
        studentEnrollments: 0,
        attempts: 0,
        expLedgerEntries: 0,
        moduleUnitProgress: 0,
        studentQuestionStates: 0,
        dailyPracticeSets: 0,
        dailyPracticeSetItems: 0,
        dailyQuests: 0,
        invites: 2,
        moduleUnits: 3,
        questions: 12,
      },
    });
  });

  it('does not mark archived modules purgeable before the 30 day window', async () => {
    prisma.module.findUnique.mockResolvedValue({
      archivedAt: new Date('2026-04-01T00:00:00.000Z'),
    } as any);

    await expect(
      service.isPurgeableArchivedModule(
        4,
        new Date('2026-04-25T00:00:00.000Z'),
      ),
    ).resolves.toBe(false);
  });

  it('does not mark archived modules purgeable when learner state exists', async () => {
    prisma.module.findUnique.mockResolvedValue({
      archivedAt: new Date('2026-03-01T00:00:00.000Z'),
    } as any);
    mockImpactCounts(prisma, {
      studentEnrollments: 1,
      attempts: 0,
      expLedgerEntries: 0,
      moduleUnitProgress: 0,
      studentQuestionStates: 0,
      dailyPracticeSets: 0,
      dailyPracticeSetItems: 0,
      dailyQuests: 0,
      invites: 0,
      moduleUnits: 1,
      questions: 1,
    });

    await expect(
      service.isPurgeableArchivedModule(
        4,
        new Date('2026-04-25T00:00:00.000Z'),
      ),
    ).resolves.toBe(false);
  });

  it('purges only archived modules that remain purgeable inside the transaction', async () => {
    prisma.module.findMany.mockResolvedValue([{ id: 4 }, { id: 5 }] as any);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: PrismaMock) => Promise<boolean>) =>
        callback(prisma),
    );
    prisma.module.findUnique
      .mockResolvedValueOnce({
        archivedAt: new Date('2026-03-01T00:00:00.000Z'),
      } as any)
      .mockResolvedValueOnce({
        archivedAt: new Date('2026-03-01T00:00:00.000Z'),
      } as any);
    mockImpactCounts(prisma, {
      studentEnrollments: 0,
      attempts: 0,
      expLedgerEntries: 0,
      moduleUnitProgress: 0,
      studentQuestionStates: 0,
      dailyPracticeSets: 0,
      dailyPracticeSetItems: 0,
      dailyQuests: 0,
      invites: 1,
      moduleUnits: 1,
      questions: 1,
    });
    mockImpactCounts(prisma, {
      studentEnrollments: 0,
      attempts: 1,
      expLedgerEntries: 0,
      moduleUnitProgress: 0,
      studentQuestionStates: 0,
      dailyPracticeSets: 0,
      dailyPracticeSetItems: 0,
      dailyQuests: 0,
      invites: 0,
      moduleUnits: 1,
      questions: 1,
    });
    prisma.module.delete.mockResolvedValue({ id: 4 } as any);

    const result = await service.purgeEligibleArchivedModules(
      new Date('2026-04-25T00:00:00.000Z'),
    );

    expect(prisma.module.findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: {
          not: null,
          lte: new Date('2026-03-26T00:00:00.000Z'),
        },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    expect(prisma.module.delete).toHaveBeenCalledTimes(1);
    expect(prisma.module.delete).toHaveBeenCalledWith({ where: { id: 4 } });
    expect(result).toEqual({ purgedModuleCount: 1 });
  });
});

function mockImpactCounts(
  prisma: PrismaMock,
  counts: {
    studentEnrollments: number;
    attempts: number;
    expLedgerEntries: number;
    moduleUnitProgress: number;
    studentQuestionStates: number;
    dailyPracticeSets: number;
    dailyPracticeSetItems: number;
    dailyQuests: number;
    invites: number;
    moduleUnits: number;
    questions: number;
  },
) {
  prismaCountMock(prisma, 'userModule').mockResolvedValueOnce(
    counts.studentEnrollments,
  );
  prismaCountMock(prisma, 'questionAttempt').mockResolvedValueOnce(
    counts.attempts,
  );
  prismaCountMock(prisma, 'expLedger').mockResolvedValueOnce(
    counts.expLedgerEntries,
  );
  prismaCountMock(prisma, 'moduleUnitUserProgress').mockResolvedValueOnce(
    counts.moduleUnitProgress,
  );
  prismaCountMock(prisma, 'studentQuestionState').mockResolvedValueOnce(
    counts.studentQuestionStates,
  );
  prismaCountMock(prisma, 'dailyPracticeSet').mockResolvedValueOnce(
    counts.dailyPracticeSets,
  );
  prismaCountMock(prisma, 'dailyPracticeSetItem').mockResolvedValueOnce(
    counts.dailyPracticeSetItems,
  );
  prismaCountMock(prisma, 'dailyQuest').mockResolvedValueOnce(
    counts.dailyQuests,
  );
  prismaCountMock(prisma, 'moduleInvite').mockResolvedValueOnce(counts.invites);
  prismaCountMock(prisma, 'moduleUnit').mockResolvedValueOnce(
    counts.moduleUnits,
  );
  prismaCountMock(prisma, 'questionUnit').mockResolvedValueOnce(
    counts.questions,
  );
}

function prismaCountMock(prisma: PrismaMock, modelName: keyof PrismaMock) {
  return (prisma as any)[modelName].count as jest.Mock;
}
