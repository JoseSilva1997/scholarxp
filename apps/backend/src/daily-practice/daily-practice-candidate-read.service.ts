// Role: loads active module questions and lesson metadata needed by future daily-practice selection rules.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DailyPracticeCandidateQuestionRecord,
  PrismaClientLike,
} from './daily-practice.types';

@Injectable()
export class DailyPracticeCandidateReadService {
  constructor(private readonly prisma: PrismaService) {}

  // Candidate reads stay isolated here so later selector services can depend on one stable, policy-free question inventory shape.
  async listModuleCandidateQuestions(
    moduleId: number,
    tx?: PrismaClientLike,
  ): Promise<DailyPracticeCandidateQuestionRecord[]> {
    const prismaClient = tx ?? this.prisma;

    const moduleUnits = await prismaClient.moduleUnit.findMany({
      where: {
        moduleId,
        status: 'live',
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        sortOrder: true,
        questionUnits: {
          where: {
            isArchived: false,
            contents: {
              some: {
                isCore: true,
                isArchived: false,
              },
            },
          },
          orderBy: [{ questionGroupId: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            title: true,
            questionGroupId: true,
            questionGroup: {
              select: {
                sortOrder: true,
              },
            },
            contents: {
              where: {
                isCore: true,
                isArchived: false,
              },
              take: 1,
              orderBy: { id: 'asc' },
              select: {
                id: true,
                type: true,
              },
            },
          },
        },
      },
    });

    const candidates: DailyPracticeCandidateQuestionRecord[] = [];
    for (const moduleUnit of moduleUnits) {
      for (const questionUnit of moduleUnit.questionUnits) {
        const coreContent = questionUnit.contents[0];
        if (!coreContent) {
          continue;
        }

        candidates.push({
          moduleUnitId: moduleUnit.id,
          moduleUnitTitle: moduleUnit.title,
          moduleUnitSortOrder: moduleUnit.sortOrder,
          questionUnitId: questionUnit.id,
          questionUnitTitle: questionUnit.title,
          questionGroupId: questionUnit.questionGroupId,
          questionGroupSortOrder: questionUnit.questionGroup?.sortOrder ?? null,
          coreContentId: coreContent.id,
          questionType: coreContent.type,
        });
      }
    }

    return candidates;
  }
}
