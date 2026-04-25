// Role: batches daily-practice generation across student-module enrollments so UTC rollover stays bounded and testable.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeGenerationService } from './daily-practice-generation.service';

const DEFAULT_BATCH_SIZE = 250;

type StudentModuleMembershipCursorRow = {
  id: number;
  userId: number;
  moduleId: number;
  user: {
    timezone: string;
  };
};

export type GenerateDailyPracticeSetsForAllStudentsResult = {
  processedMembershipCount: number;
  createdSetCount: number;
  failedMembershipCount: number;
};

type GenerateDailyPracticeSetsForAllStudentsOptions = {
  onlyLocalMidnightWindow?: boolean;
};

@Injectable()
export class DailyPracticeGenerationBatchService {
  private readonly logger = new Logger(
    DailyPracticeGenerationBatchService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyPracticeGenerationService: DailyPracticeGenerationService,
  ) {}

  // Cursor pagination keeps midnight generation stable as enrollment volume grows without loading every membership at once.
  async generateDailyPracticeSetsForAllStudents(
    timestamp: Date = new Date(),
    batchSize: number = DEFAULT_BATCH_SIZE,
    options: GenerateDailyPracticeSetsForAllStudentsOptions = {},
  ): Promise<GenerateDailyPracticeSetsForAllStudentsResult> {
    const normalizedBatchSize = Math.max(1, Math.floor(batchSize));
    const onlyLocalMidnightWindow = options.onlyLocalMidnightWindow ?? false;
    let lastMembershipId: number | null = null;
    let processedMembershipCount = 0;
    let createdSetCount = 0;
    let failedMembershipCount = 0;

    while (true) {
      const studentMemberships = (await this.prisma.userModule.findMany({
        where: {
          roleInModule: 'student',
          module: { archivedAt: null },
          ...(lastMembershipId === null
            ? {}
            : { id: { gt: lastMembershipId } }),
        },
        select: {
          id: true,
          userId: true,
          moduleId: true,
          user: {
            select: {
              timezone: true,
            },
          },
        },
        orderBy: {
          id: 'asc',
        },
        take: normalizedBatchSize,
      })) as StudentModuleMembershipCursorRow[];

      if (studentMemberships.length === 0) {
        return {
          processedMembershipCount,
          createdSetCount,
          failedMembershipCount,
        };
      }

      for (const membership of studentMemberships) {
        if (
          onlyLocalMidnightWindow &&
          !this.isWithinLocalMidnightWindow(
            timestamp,
            membership.user.timezone ?? 'UTC',
          )
        ) {
          continue;
        }

        try {
          const result =
            await this.dailyPracticeGenerationService.ensureSetGenerated(
              membership.moduleId,
              membership.userId,
              timestamp,
            );
          processedMembershipCount += 1;
          if (result.status === 'created') {
            createdSetCount += 1;
          }
        } catch (error) {
          failedMembershipCount += 1;
          this.logger.error(
            `Failed to generate daily practice for user ${membership.userId} in module ${membership.moduleId}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      lastMembershipId = studentMemberships[studentMemberships.length - 1].id;
    }
  }

  private isWithinLocalMidnightWindow(
    timestamp: Date,
    timezone: string,
  ): boolean {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(timestamp);

    const hour = parseInt(
      parts.find((part) => part.type === 'hour')?.value ?? '0',
      10,
    );
    const minute = parseInt(
      parts.find((part) => part.type === 'minute')?.value ?? '0',
      10,
    );

    // Quarter-hour polling covers full-, half-, and quarter-offset zones while keeping each cycle bounded.
    return hour % 24 === 0 && minute < 15;
  }
}
