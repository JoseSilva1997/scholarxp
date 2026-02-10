import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeRoomResponseDto } from './dto/practice-room-response.dto';
import { PracticeRoomMapper } from './practice-room.mapper';
import type {
  LatestAttemptSnapshot,
  LoadedModuleUnit,
  RoomQuestionUnitDraft,
} from './practice-room.types';

// PracticeRoomService builds the page-load payload so the frontend can render core questions, variants, and latest attempts.
@Injectable()
export class PracticeRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practiceRoomMapper: PracticeRoomMapper,
  ) {}

  // Builds the initial room state for one student in one module unit and opens a fresh practice session.
  async getPracticeRoom(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
  ): Promise<PracticeRoomResponseDto> {
    const moduleUnit = await this.getModuleUnitOrThrow(moduleId, moduleUnitId);
    const session = await this.createPracticeSession(moduleId, studentId);
    const questionUnitDrafts =
      this.practiceRoomMapper.toQuestionUnitDrafts(moduleUnit);
    const latestAttempts = await this.getLatestAttempts(
      moduleUnitId,
      studentId,
      questionUnitDrafts,
    );
    const latestAttemptByKey =
      this.practiceRoomMapper.toLatestAttemptMap(latestAttempts);

    return this.practiceRoomMapper.buildResponse({
      sessionId: session.id.toString(),
      moduleUnitId: moduleUnit.id,
      moduleUnitTitle: moduleUnit.title,
      questionUnitDrafts,
      latestAttemptByKey,
    });
  }

  // Loads module-unit content in one query to avoid round-trips while building the room payload.
  private async getModuleUnitOrThrow(
    moduleId: number,
    moduleUnitId: number,
  ): Promise<LoadedModuleUnit> {
    const moduleUnit = await this.prisma.moduleUnit.findFirst({
      where: { id: moduleUnitId, moduleId },
      select: {
        id: true,
        title: true,
        questionUnits: {
          where: { isArchived: false },
          orderBy: [{ questionGroupId: 'asc' }, { id: 'asc' }],
          include: {
            contents: {
              where: { isArchived: false },
              orderBy: { id: 'asc' },
            },
            variants: {
              where: {
                content: {
                  isArchived: false,
                },
              },
              orderBy: { id: 'asc' },
              include: { content: true },
            },
          },
        },
      },
    });

    if (!moduleUnit) {
      throw new NotFoundException('Module unit not found');
    }

    return moduleUnit;
  }

  // Creates a session up front so the frontend can immediately reference it for subsequent attempt submissions.
  private createPracticeSession(moduleId: number, studentId: number) {
    return this.prisma.practiceSession.create({
      data: {
        moduleId,
        userId: studentId,
        // Starting a fresh session on room load provides a stable id for immediate UI wiring.
        startTime: new Date(),
      },
      select: { id: true },
    });
  }

  // Fetches attempts once so the mapper can derive latest-per-content snapshots in one place.
  private async getLatestAttempts(
    moduleUnitId: number,
    studentId: number,
    questionUnitDrafts: RoomQuestionUnitDraft[],
  ): Promise<LatestAttemptSnapshot[]> {
    const questionUnitIds = questionUnitDrafts.map(
      (questionUnit) => questionUnit.questionUnitId,
    );
    const contentIds = questionUnitDrafts.flatMap((questionUnit) => [
      questionUnit.coreContentId,
      ...questionUnit.variantContentIds,
    ]);

    const latestAttempts =
      questionUnitIds.length === 0 || contentIds.length === 0
        ? []
        : await this.prisma.questionAttempt.findMany({
            where: {
              moduleUnitId,
              studentId,
              questionId: { in: questionUnitIds },
              contentId: { in: contentIds },
            },
            orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
            select: {
              questionId: true,
              contentId: true,
              studentAnswer: true,
              isCorrect: true,
              attemptedAt: true,
            },
          });
    return latestAttempts.map((attempt) => ({
      questionId: attempt.questionId,
      contentId: attempt.contentId,
      studentAnswer: attempt.studentAnswer,
      isCorrect: attempt.isCorrect,
      attemptedAt: attempt.attemptedAt,
    }));
  }
}
