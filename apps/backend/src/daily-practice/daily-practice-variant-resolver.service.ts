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
        select: {
          questionId: true,
          contentId: true,
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

    const seenContentIdsByQuestionId = new Map<number, Set<number>>();
    for (const attempt of attempts) {
      const existing =
        seenContentIdsByQuestionId.get(attempt.questionId) ?? new Set<number>();
      existing.add(attempt.contentId);
      seenContentIdsByQuestionId.set(attempt.questionId, existing);
    }

    return orderedQuestions.map((question) => ({
      ...question,
      questionContentId: this.resolveQuestionContentId(
        question.coreContentId,
        activeVariantContentIdsByQuestionId.get(question.questionUnitId) ?? [],
        seenContentIdsByQuestionId.get(question.questionUnitId),
      ),
    }));
  }

  private resolveQuestionContentId(
    coreContentId: number,
    activeVariantContentIds: number[],
    seenContentIds: Set<number> | undefined,
  ): number {
    const unseenVariantContentId = activeVariantContentIds.find(
      (contentId) => !seenContentIds?.has(contentId),
    );

    return unseenVariantContentId ?? coreContentId;
  }
}
