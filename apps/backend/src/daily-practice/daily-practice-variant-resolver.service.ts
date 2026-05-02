// Role: chooses which content each daily-practice question should display so unseen variants can rotate without changing question-level FSRS state.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  OrderedDailyPracticeQuestionRecord,
  PrismaClientLike,
  ResolvedDailyPracticeQuestionRecord,
} from './daily-practice.types';

@Injectable()
export class DailyPracticeVariantResolverService {
  constructor(private readonly prisma: PrismaService) {}

  // Variant choice is resolved once per set so refreshes never swap the presented content mid-day.
  // Unseen variants come first; once all active variants were seen, the least-recently seen variant is reused.
  async resolveQuestionContentIds(
    userId: number,
    orderedQuestions: OrderedDailyPracticeQuestionRecord[],
    tx?: PrismaClientLike,
  ): Promise<ResolvedDailyPracticeQuestionRecord[]> {
    if (orderedQuestions.length === 0) {
      return [];
    }

    const prismaClient = tx ?? this.prisma;
    const questionUnitIds = orderedQuestions.map(
      (question) => question.questionUnitId,
    );
    const [variants, attempts] = await Promise.all([
      prismaClient.questionVariant.findMany({
        where: {
          questionUnitId: {
            in: questionUnitIds,
          },
          content: {
            isArchived: false,
          },
        },
        orderBy: [{ questionUnitId: 'asc' }, { id: 'asc' }],
        select: {
          questionUnitId: true,
          contentId: true,
        },
      }),
      prismaClient.questionAttempt.findMany({
        where: {
          studentId: userId,
          questionId: {
            in: questionUnitIds,
          },
        },
        orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
        select: {
          questionId: true,
          contentId: true,
          attemptedAt: true,
        },
      }),
    ]);

    const activeVariantContentIdsByQuestionId = new Map<number, number[]>();
    for (const variant of variants) {
      const existing =
        activeVariantContentIdsByQuestionId.get(variant.questionUnitId) ?? [];
      existing.push(variant.contentId);
      activeVariantContentIdsByQuestionId.set(variant.questionUnitId, existing);
    }

    const latestSeenAtByQuestionId = new Map<number, Map<number, Date>>();
    for (const attempt of attempts) {
      const latestSeenAtByContentId =
        latestSeenAtByQuestionId.get(attempt.questionId) ??
        new Map<number, Date>();
      const existingSeenAt = latestSeenAtByContentId.get(attempt.contentId);
      if (
        !existingSeenAt ||
        existingSeenAt.getTime() < attempt.attemptedAt.getTime()
      ) {
        latestSeenAtByContentId.set(attempt.contentId, attempt.attemptedAt);
      }
      latestSeenAtByQuestionId.set(attempt.questionId, latestSeenAtByContentId);
    }

    return orderedQuestions.map((question) => ({
      ...question,
      questionContentId: this.resolveQuestionContentId(
        question.coreContentId,
        activeVariantContentIdsByQuestionId.get(question.questionUnitId) ?? [],
        latestSeenAtByQuestionId.get(question.questionUnitId),
      ),
    }));
  }

  // Variant selection strategy: unseen variants take priority; once all variants have been seen, the least-recently-seen variant is chosen to maintain novelty.
  // Falls back to coreContentId when no active variants exist.
  private resolveQuestionContentId(
    coreContentId: number,
    activeVariantContentIds: number[],
    latestSeenAtByContentId: Map<number, Date> | undefined,
  ): number {
    if (activeVariantContentIds.length === 0) {
      return coreContentId;
    }

    const unseenVariantContentId = activeVariantContentIds.find(
      (contentId) => !latestSeenAtByContentId?.has(contentId),
    );
    if (unseenVariantContentId) {
      return unseenVariantContentId;
    }

    const leastRecentlySeenVariantContentId = activeVariantContentIds.reduce(
      (currentLeastRecent, contentId) => {
        if (currentLeastRecent === null) {
          return contentId;
        }

        const seenAt = latestSeenAtByContentId?.get(contentId);
        const currentLeastRecentSeenAt =
          latestSeenAtByContentId?.get(currentLeastRecent);
        if (!seenAt || !currentLeastRecentSeenAt) {
          return currentLeastRecent;
        }

        return seenAt.getTime() < currentLeastRecentSeenAt.getTime()
          ? contentId
          : currentLeastRecent;
      },
      null as number | null,
    );

    return leastRecentlySeenVariantContentId ?? coreContentId;
  }
}
