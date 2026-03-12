// Service role: centralizes practice-question eligibility so XP distribution uses one consistent source.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeQuestionContext, PrismaClientLike } from './exp-engine.types';

@Injectable()
export class ExpQuestionContextService {
  // Use the same eligibility filters as practice submission so reward math stays aligned with playable questions.
  async getPracticeQuestionContext(
    moduleUnitId: number,
    tx?: PrismaClientLike,
  ): Promise<PracticeQuestionContext> {
    const prismaClient = tx ?? this.prisma;
    const eligibleQuestions = await prismaClient.questionUnit.findMany({
      where: {
        moduleUnitId,
        isArchived: false,
        contents: {
          some: {
            isCore: true,
            isArchived: false,
          },
        },
      },
      orderBy: [{ questionGroupId: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    return {
      totalQuestions: eligibleQuestions.length,
      // The last question receives any rounding remainder so pool totals always reconcile exactly.
      lastQuestionId: eligibleQuestions.at(-1)?.id ?? null,
    };
  }

  constructor(private readonly prisma: PrismaService) {}
}
