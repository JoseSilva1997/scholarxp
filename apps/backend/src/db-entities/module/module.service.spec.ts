// Tests for ModuleService enforcing scoped creation and filtered reads.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { ModuleService } from './module.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';

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

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ModuleService(prisma);
  });

  afterEach(() => jest.resetAllMocks());

  it('creates module with creator id and institution check for teacher', async () => {
    prisma.ltiIdentity.findFirst.mockResolvedValue({ id: 1 } as any);
    const dto = {
      institutionId: 5,
      variantContext: 'ctx',
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
    const dto = { variantContext: 'ctx', title: 'X' };

    await expect(
      service.create(dto as any, instAdmin as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects teacher with institution membership creating any module', async () => {
    const dto = { title: 'Nope' };

    await expect(
      service.create(dto as any, teacherWithInstitution as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.module.create).not.toHaveBeenCalled();
  });

  it('findAll returns all for admin', async () => {
    prisma.module.findMany.mockResolvedValue([{ id: 1 }] as any);

    const result = await service.findAll(admin as any);

    expect(result).toEqual([{ id: 1 }]);
    expect(prisma.module.findMany).toHaveBeenCalledWith();
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
});
