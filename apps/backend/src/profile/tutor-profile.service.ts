// Aggregates tutor-facing profile data from module ownership, enrolment, and invite records.
// Only depends on PrismaService directly, as tutors have no gamification state to aggregate.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import type {
  TutorProfileModule,
  TutorProfileResponse,
} from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '@scholarxp/api-contracts';

@Injectable()
export class TutorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // Builds the complete TutorProfileResponse. Module ownership is resolved via a dual OR condition
  // (creator or teacher role) to support co-teaching. Pending-invite and active-student counts
  // are fetched in parallel once the module list is known. Falls back to session user data for
  // the profile card if the database record cannot be found.
  async getTutorProfile(user: AuthUser): Promise<TutorProfileResponse> {
    if (user.globalRole !== GlobalRole.teacher) {
      throw new ForbiddenException('Only tutors can access the tutor profile.');
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Load all modules owned by this tutor (via createdByUserId or teacher role in UserModule).
    const tutorModules = await this.prisma.module.findMany({
      where: {
        archivedAt: null,
        OR: [
          { createdByUserId: user.id },
          {
            userModules: {
              some: { userId: user.id, roleInModule: 'teacher' },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        moduleUnits: {
          select: { id: true, status: true, createdAt: true },
        },
        userModules: {
          where: { roleInModule: 'student' },
          select: { userId: true },
        },
      },
    });

    const moduleIds = tutorModules.map((m) => m.id);

    const [pendingInvites, studentsActiveLast7Days] = await Promise.all([
      this.countPendingInvites(user.id),
      this.countStudentsActiveLast7Days(moduleIds, sevenDaysAgo),
    ]);

    const modules: TutorProfileModule[] = tutorModules.map((m) => ({
      moduleId: m.id,
      title: m.title,
      studentCount: m.userModules.length,
      liveLessons: m.moduleUnits.filter((u) => u.status === 'live').length,
      draftLessons: m.moduleUnits.filter((u) => u.status === 'draft').length,
      lastActivity: this.deriveLastActivity(m),
    }));

    const totalEnrolledStudents = this.countUniqueStudents(tutorModules);
    const liveLessonsPublished = tutorModules.reduce(
      (sum, m) => sum + m.moduleUnits.filter((u) => u.status === 'live').length,
      0,
    );

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    return {
      modulesCreated: tutorModules.length,
      liveLessonsPublished,
      totalEnrolledStudents,
      studentsActiveLast7Days,
      pendingInvites,
      modules,
      // TODO: Event tracking does not yet exist — return empty array until an activity log table is added.
      recentActivity: [],
      profile: {
        name: dbUser
          ? `${dbUser.firstName} ${dbUser.lastName}`.trim()
          : user.firstName + ' ' + user.lastName,
        email: dbUser?.email ?? user.email,
        role: 'Teacher',
        bio: null,
      },
    };
  }

  // Counts active invites created by this tutor that still have remaining uses.
  // An invite is "pending" when it is not revoked, not expired, and uses < maxUses (null = unlimited).
  // The remaining-uses check cannot be expressed in a Prisma WHERE clause because Prisma does not
  // support column-to-column comparisons, so the exhausted-invite filter runs in application code.
  private async countPendingInvites(userId: number): Promise<number> {
    const invites = await this.prisma.moduleInvite.findMany({
      where: {
        createdByUserId: userId,
        module: { archivedAt: null },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { maxUses: true, uses: true },
    });

    return invites.filter(
      (inv) => inv.maxUses === null || inv.uses < inv.maxUses,
    ).length;
  }

  // Counts distinct students who completed at least one daily practice set in the rolling 7-day window
  // across any of the tutor's modules. Distinct is applied at the database level. Returns 0 immediately
  // for tutors with no modules to avoid issuing an IN query with an empty list.
  private async countStudentsActiveLast7Days(
    moduleIds: number[],
    since: Date,
  ): Promise<number> {
    if (moduleIds.length === 0) return 0;

    const activeSets = await this.prisma.dailyPracticeSet.findMany({
      where: {
        moduleId: { in: moduleIds },
        completedAt: { gte: since },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    return activeSets.length;
  }

  // Deduplicates enrolled students across modules using a Set, so a student who joins multiple
  // modules under the same tutor is counted once in the total enrolment figure.
  private countUniqueStudents(
    tutorModules: Array<{ userModules: Array<{ userId: number }> }>,
  ): number {
    const studentIds = new Set<number>();
    for (const m of tutorModules) {
      for (const um of m.userModules) {
        studentIds.add(um.userId);
      }
    }
    return studentIds.size;
  }

  // Returns the ISO timestamp of the most recent creation event within the module (module itself or
  // any unit) as a proxy for last activity. A dedicated event-log table does not yet exist, so
  // creation timestamps are the best available signal for recency.
  private deriveLastActivity(module: {
    createdAt: Date;
    moduleUnits: Array<{ createdAt: Date }>;
  }): string {
    const dates = [
      module.createdAt,
      ...module.moduleUnits.map((u) => u.createdAt),
    ];
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    return latest.toISOString();
  }
}
