// Verifies TutorProfileService aggregates tutor-owned modules, enrollment, invites, and profile fallback data.
import { ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import type { AuthUser } from '../types/auth-user.type';
import { TutorProfileService } from './tutor-profile.service';

describe('TutorProfileService', () => {
  let service: TutorProfileService;
  let prisma: PrismaMock;

  const tutorUser: AuthUser = {
    id: 5,
    firstName: 'Marie',
    lastName: 'Curie',
    email: 'marie@example.com',
    profilePictureUrl: null,
    globalRole: GlobalRole.teacher,
    isVerified: true,
    requiresEmailVerification: false,
    avatar: null,
    timezone: 'UTC',
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    jest.useFakeTimers().setSystemTime(new Date('2026-04-28T12:00:00.000Z'));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TutorProfileService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TutorProfileService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('rejects non-teacher users before querying profile data', async () => {
    await expect(
      service.getTutorProfile({
        ...tutorUser,
        globalRole: GlobalRole.student,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.module.findMany).not.toHaveBeenCalled();
  });

  it('aggregates modules, unique students, live lessons, pending invites, and active students', async () => {
    prisma.module.findMany.mockResolvedValue([
      {
        id: 10,
        title: 'Physics',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        moduleUnits: [
          {
            id: 100,
            status: 'live',
            createdAt: new Date('2026-03-10T00:00:00.000Z'),
          },
          {
            id: 101,
            status: 'draft',
            createdAt: new Date('2026-03-12T00:00:00.000Z'),
          },
        ],
        userModules: [{ userId: 1 }, { userId: 2 }],
      },
      {
        id: 11,
        title: 'Chemistry',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        moduleUnits: [
          {
            id: 200,
            status: 'live',
            createdAt: new Date('2026-02-03T00:00:00.000Z'),
          },
        ],
        userModules: [{ userId: 2 }, { userId: 3 }],
      },
    ] as never);
    prisma.moduleInvite.findMany.mockResolvedValue([
      { maxUses: null, uses: 100 },
      { maxUses: 5, uses: 4 },
      { maxUses: 5, uses: 5 },
    ] as never);
    prisma.dailyPracticeSet.findMany.mockResolvedValue([
      { userId: 1 },
      { userId: 3 },
    ] as never);
    prisma.user.findUnique.mockResolvedValue({
      firstName: 'Dr.',
      lastName: 'Curie',
      email: 'dr.curie@example.com',
    } as never);

    const result = await service.getTutorProfile(tutorUser);

    expect(prisma.module.findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        OR: [
          { createdByUserId: tutorUser.id },
          {
            userModules: {
              some: { userId: tutorUser.id, roleInModule: 'teacher' },
            },
          },
        ],
      },
      select: expect.any(Object),
    });
    expect(prisma.dailyPracticeSet.findMany).toHaveBeenCalledWith({
      where: {
        moduleId: { in: [10, 11] },
        completedAt: { gte: new Date('2026-04-21T12:00:00.000Z') },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    expect(result).toEqual({
      modulesCreated: 2,
      liveLessonsPublished: 2,
      totalEnrolledStudents: 3,
      studentsActiveLast7Days: 2,
      pendingInvites: 2,
      modules: [
        {
          moduleId: 10,
          title: 'Physics',
          studentCount: 2,
          liveLessons: 1,
          draftLessons: 1,
          lastActivity: '2026-03-12T00:00:00.000Z',
        },
        {
          moduleId: 11,
          title: 'Chemistry',
          studentCount: 2,
          liveLessons: 1,
          draftLessons: 0,
          lastActivity: '2026-02-03T00:00:00.000Z',
        },
      ],
      recentActivity: [],
      profile: {
        name: 'Dr. Curie',
        email: 'dr.curie@example.com',
        role: 'Teacher',
        bio: null,
      },
    });
  });

  it('skips active-student lookup for tutors with no modules and falls back to session profile data', async () => {
    prisma.module.findMany.mockResolvedValue([] as never);
    prisma.moduleInvite.findMany.mockResolvedValue([] as never);
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.getTutorProfile(tutorUser);

    expect(prisma.dailyPracticeSet.findMany).not.toHaveBeenCalled();
    expect(result.studentsActiveLast7Days).toBe(0);
    expect(result.modules).toEqual([]);
    expect(result.profile).toEqual({
      name: 'Marie Curie',
      email: 'marie@example.com',
      role: 'Teacher',
      bio: null,
    });
  });
});
