// Role: owns persisted daily-practice set reads so future controllers and selectors do not duplicate day-window and include logic.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateHelpers } from '../helpers/helpers';
import type {
  PersistedDailyPracticeSetRecord,
  PrismaClientLike,
} from './daily-practice.types';

@Injectable()
export class DailyPracticeSetReadService {
  constructor(private readonly prisma: PrismaService) {}

  // One stable set per local calendar day is a core product rule, so "find today's set" lives here instead of being reimplemented in callers.
  findSetForUtcDay(
    userId: number,
    moduleId: number,
    timestamp: Date,
    timezone: string = 'UTC',
    tx?: PrismaClientLike,
  ): Promise<PersistedDailyPracticeSetRecord | null> {
    const prismaClient = tx ?? this.prisma;
    // The DB column is @db.Date, which stores the local calendar date — derive it from the user's timezone.
    const localDateKey = DateHelpers.getLocalDateKey(timestamp, timezone);
    const practiceDateUtc = new Date(`${localDateKey}T00:00:00.000Z`);

    return prismaClient.dailyPracticeSet.findUnique({
      where: {
        userId_moduleId_practiceDateUtc: {
          userId,
          moduleId,
          practiceDateUtc,
        },
      },
      select: {
        id: true,
        userId: true,
        moduleId: true,
        practiceDateUtc: true,
        generatedAt: true,
        completedAt: true,
        algorithmVersion: true,
        items: {
          orderBy: [{ position: 'asc' }, { questionUnitId: 'asc' }],
          select: {
            id: true,
            dailyPracticeSetId: true,
            questionUnitId: true,
            questionContentId: true,
            moduleUnitId: true,
            position: true,
            selectionReason: true,
            selectionScore: true,
            sourceBucket: true,
          },
        },
      },
    });
  }

  // Direct id lookup is useful for later resume/read flows once controllers expose set-specific routes.
  findSetById(
    setId: string,
    tx?: PrismaClientLike,
  ): Promise<PersistedDailyPracticeSetRecord | null> {
    const prismaClient = tx ?? this.prisma;

    return prismaClient.dailyPracticeSet.findUnique({
      where: {
        id: setId,
      },
      select: {
        id: true,
        userId: true,
        moduleId: true,
        practiceDateUtc: true,
        generatedAt: true,
        completedAt: true,
        algorithmVersion: true,
        items: {
          orderBy: [{ position: 'asc' }, { questionUnitId: 'asc' }],
          select: {
            id: true,
            dailyPracticeSetId: true,
            questionUnitId: true,
            questionContentId: true,
            moduleUnitId: true,
            position: true,
            selectionReason: true,
            selectionScore: true,
            sourceBucket: true,
          },
        },
      },
    });
  }

  // Submit flows need an ownership-safe set lookup by id so route params and payload ids cannot cross modules or users.
  findOwnedSetById(
    setId: string,
    userId: number,
    moduleId: number,
    tx?: PrismaClientLike,
  ): Promise<PersistedDailyPracticeSetRecord | null> {
    const prismaClient = tx ?? this.prisma;

    return prismaClient.dailyPracticeSet.findFirst({
      where: {
        id: setId,
        userId,
        moduleId,
      },
      select: {
        id: true,
        userId: true,
        moduleId: true,
        practiceDateUtc: true,
        generatedAt: true,
        completedAt: true,
        algorithmVersion: true,
        items: {
          orderBy: [{ position: 'asc' }, { questionUnitId: 'asc' }],
          select: {
            id: true,
            dailyPracticeSetId: true,
            questionUnitId: true,
            questionContentId: true,
            moduleUnitId: true,
            position: true,
            selectionReason: true,
            selectionScore: true,
            sourceBucket: true,
          },
        },
      },
    });
  }
}
