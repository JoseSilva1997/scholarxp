// Role: batches quest-day generation across all students so UTC-midnight rollover can reuse one testable backend seam.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestGenerationService } from './quest-generation.service';

const DEFAULT_BATCH_SIZE = 250;

type StudentMembershipCursorRow = {
  userId: number;
};

export type GenerateQuestDayForAllStudentsResult = {
  processedUserCount: number;
  failedUserCount: number;
};

@Injectable()
export class QuestGenerationBatchService {
  private readonly logger = new Logger(QuestGenerationBatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questGenerationService: QuestGenerationService,
  ) {}

  // Cursor pagination keeps the midnight rollover bounded in memory even if student enrollment grows.
  async generateQuestDayForAllStudents(
    timestamp: Date = new Date(),
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): Promise<GenerateQuestDayForAllStudentsResult> {
    const normalizedBatchSize = Math.max(1, Math.floor(batchSize));
    let lastUserId: number | null = null;
    let processedUserCount = 0;
    let failedUserCount = 0;

    while (true) {
      const studentMemberships = (await this.prisma.userModule.findMany({
        where: {
          roleInModule: 'student',
          ...(lastUserId === null ? {} : { userId: { gt: lastUserId } }),
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
        orderBy: {
          userId: 'asc',
        },
        take: normalizedBatchSize,
      })) as StudentMembershipCursorRow[];

      if (studentMemberships.length === 0) {
        return {
          processedUserCount,
          failedUserCount,
        };
      }

      for (const membership of studentMemberships) {
        try {
          // Reuse the existing per-user generation rules so batch generation cannot drift from on-demand generation.
          await this.questGenerationService.ensureQuestDayGeneratedForUser(
            membership.userId,
            timestamp,
          );
          processedUserCount += 1;
        } catch (error) {
          failedUserCount += 1;
          this.logger.error(
            `Failed to generate daily quests for student ${membership.userId}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      lastUserId = studentMemberships[studentMemberships.length - 1].userId;
    }
  }
}
