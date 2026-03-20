// Role: enforces when module-scoped daily practice may unlock so adaptive review starts only after baseline lesson completion.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';

const DAILY_PRACTICE_LOCKED_MESSAGE =
  'Complete your first lesson in this module to unlock daily practice tomorrow.';
const DAILY_PRACTICE_UNLOCKS_TOMORROW_MESSAGE =
  'Daily practice unlocks tomorrow after you complete your first lesson in this module.';

@Injectable()
export class DailyPracticeEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  // The gate is driven by persisted module-unit completion so students see a stable, product-owned unlock rule instead of an implementation detail.
  async assertEligibleForToday(
    moduleId: number,
    studentId: number,
    now: Date,
  ): Promise<void> {
    const earliestCompletion =
      await this.prisma.moduleUnitUserProgress.findFirst({
        where: {
          studentId,
          isCompleted: true,
          completedAt: {
            not: null,
          },
          moduleUnit: {
            moduleId,
          },
        },
        orderBy: [{ completedAt: 'asc' }, { moduleUnitId: 'asc' }],
        select: {
          completedAt: true,
        },
      });

    if (!earliestCompletion?.completedAt) {
      throw new ForbiddenException(DAILY_PRACTICE_LOCKED_MESSAGE);
    }

    const { dayStartUtc } = DateHelpers.getUtcDayBounds(now);
    if (earliestCompletion.completedAt.getTime() >= dayStartUtc.getTime()) {
      throw new ForbiddenException(DAILY_PRACTICE_UNLOCKS_TOMORROW_MESSAGE);
    }
  }
}
