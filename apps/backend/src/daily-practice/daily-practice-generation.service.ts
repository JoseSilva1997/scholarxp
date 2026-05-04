// Role: generates one stable daily-practice set per student/module/day so reads never depend on request timing.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DailyPracticeAlgorithmVersionValues } from '@scholarxp/api-contracts';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeEligibilityService } from './daily-practice-eligibility.service';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import { DailyPracticeVariantResolverService } from './daily-practice-variant-resolver.service';
import type { OrderedDailyPracticeQuestionRecord } from './daily-practice.types';

export type EnsureDailyPracticeSetGeneratedResult = {
  status: 'created' | 'already_exists' | 'ineligible' | 'no_set';
};

@Injectable()
export class DailyPracticeGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyPracticeSetReadService: DailyPracticeSetReadService,
    private readonly dailyPracticeSetSelectorService: DailyPracticeSetSelectorService,
    private readonly dailyPracticeInterleavingService: DailyPracticeInterleavingService,
    private readonly dailyPracticeEligibilityService: DailyPracticeEligibilityService,
    private readonly dailyPracticeVariantResolverService: DailyPracticeVariantResolverService,
  ) {}

  // Generation returns an explicit outcome so batch jobs can distinguish "nothing to do" from real failures.
  async ensureSetGenerated(
    moduleId: number,
    studentId: number,
    timestamp: Date,
  ): Promise<EnsureDailyPracticeSetGeneratedResult> {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { timezone: true },
    });
    const timezone = userRecord?.timezone ?? 'UTC';

    const existingSet = await this.dailyPracticeSetReadService.findSetForUtcDay(
      studentId,
      moduleId,
      timestamp,
      timezone,
    );
    if (existingSet) {
      return {
        status: existingSet.items.length === 0 ? 'no_set' : 'already_exists',
      };
    }

    try {
      await this.dailyPracticeEligibilityService.assertEligibleForToday(
        moduleId,
        studentId,
        timestamp,
        timezone,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return { status: 'ineligible' };
      }
      throw error;
    }

    const orderedQuestions = await this.buildOrderedSelection(
      moduleId,
      studentId,
      timestamp,
    );
    const resolvedQuestions =
      await this.dailyPracticeVariantResolverService.resolveQuestionContentIds(
        studentId,
        orderedQuestions,
      );

    // Store the local calendar date as the practice date — same convention as questDateUtc on DailyQuest.
    const localDateKey = DateHelpers.getLocalDateKey(timestamp, timezone);
    const dayStartDb = new Date(`${localDateKey}T00:00:00.000Z`);

    if (resolvedQuestions.length === 0) {
      return this.persistEmptySetSentinel(
        moduleId,
        studentId,
        dayStartDb,
        timezone,
      );
    }

    return this.persistResolvedSet(
      moduleId,
      studentId,
      timestamp,
      dayStartDb,
      timezone,
      resolvedQuestions,
    );
  }

  // Runs selector then interleaver in sequence so generation always produces a lesson-varied ordered list without callers managing the two-step pipeline.
  private async buildOrderedSelection(
    moduleId: number,
    studentId: number,
    timestamp: Date,
  ): Promise<OrderedDailyPracticeQuestionRecord[]> {
    const selection =
      await this.dailyPracticeSetSelectorService.selectQuestions({
        userId: studentId,
        moduleId,
        now: timestamp,
      });

    return this.dailyPracticeInterleavingService.orderSelectedQuestions(
      selection.selectedQuestions,
    );
  }

  // Persists a set row with no items to record that generation ran but produced nothing. Future reads treat this as "no set" rather than "not generated yet", preventing redundant batch runs.
  private async persistEmptySetSentinel(
    moduleId: number,
    studentId: number,
    dayStartDb: Date,
    timezone: string,
  ): Promise<EnsureDailyPracticeSetGeneratedResult> {
    try {
      await this.prisma.dailyPracticeSet.create({
        data: {
          userId: studentId,
          moduleId,
          practiceDateUtc: dayStartDb,
          algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
        },
        select: { id: true },
      });
      return { status: 'no_set' };
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        return this.resolveConcurrentGenerationResult(
          studentId,
          moduleId,
          dayStartDb,
          timezone,
        );
      }

      throw error;
    }
  }

  // Atomically creates the set and all its items. A unique constraint on userId/moduleId/practiceDateUtc prevents duplicate sets when concurrent processes race to generate the same day.
  private async persistResolvedSet(
    moduleId: number,
    studentId: number,
    timestamp: Date,
    dayStartDb: Date,
    timezone: string,
    resolvedQuestions: Array<{
      questionUnitId: number;
      questionContentId: number;
      moduleUnitId: number;
      position: number;
      selectionReason: string;
      selectionScore: number;
      sourceBucket: string;
    }>,
  ): Promise<EnsureDailyPracticeSetGeneratedResult> {
    try {
      await this.prisma.dailyPracticeSet.create({
        data: {
          userId: studentId,
          moduleId,
          practiceDateUtc: dayStartDb,
          algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
          items: {
            create: resolvedQuestions.map((question) => ({
              questionUnitId: question.questionUnitId,
              questionContentId: question.questionContentId,
              moduleUnitId: question.moduleUnitId,
              position: question.position,
              selectionReason: question.selectionReason,
              selectionScore: question.selectionScore,
              sourceBucket: question.sourceBucket,
            })),
          },
        },
        select: { id: true },
      });

      return { status: 'created' };
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        return this.resolveConcurrentGenerationResult(
          studentId,
          moduleId,
          timestamp,
          timezone,
        );
      }

      throw error;
    }
  }

  // Re-reads the set after a unique constraint violation so both competing processes return a consistent outcome rather than surfacing a raw DB error.
  private async resolveConcurrentGenerationResult(
    studentId: number,
    moduleId: number,
    timestamp: Date,
    timezone: string,
  ): Promise<EnsureDailyPracticeSetGeneratedResult> {
    const concurrentSet =
      await this.dailyPracticeSetReadService.findSetForUtcDay(
        studentId,
        moduleId,
        timestamp,
        timezone,
      );
    if (concurrentSet) {
      return {
        status: concurrentSet.items.length === 0 ? 'no_set' : 'already_exists',
      };
    }

    throw new Error(
      'Daily practice set could not be loaded after creation race.',
    );
  }

  // Prisma error code P2002 signals a unique constraint violation — used to detect the concurrent-generation race without catching all DB errors.
  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
