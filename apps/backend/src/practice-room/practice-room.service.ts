import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeRoomResponseDto } from './dto/practice-room-response.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';
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
      sessionId: session.id,
      moduleUnitId: moduleUnit.id,
      moduleUnitTitle: moduleUnit.title,
      questionUnitDrafts,
      latestAttemptByKey,
    });
  }

  // Persists one practice-room answer attempt and returns first-correct eligibility for downstream XP handling.
  async submitAttempt(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
    payload: SubmitAttemptDto,
  ): Promise<SubmitAttemptResponseDto> {
    this.validateModuleUnitPayload(moduleUnitId, payload.moduleUnitId);
    await this.validateSession(moduleId, studentId, payload.sessionId);
    await this.validateQuestionContent(
      moduleUnitId,
      payload.questionUnitId,
      payload.questionContentId,
    );

    const alreadyHasCorrectAttempt = await this.hasAnyCorrectAttempt(
      moduleUnitId,
      studentId,
      payload.questionUnitId,
    );

    await this.createAttemptRecord(moduleUnitId, studentId, payload);

    // XP engine integration is intentionally deferred; this flag lets the future engine gate first-correct rewards.
    return {
      moduleExpAwarded: 0,
      studentExpAwarded: 0,
      hasCorrectAttempt: alreadyHasCorrectAttempt || payload.isCorrect,
    };
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

  // Route params remain the source of truth, so payload moduleUnitId must match to prevent accidental cross-unit writes.
  private validateModuleUnitPayload(
    routeModuleUnitId: number,
    payloadModuleUnitId: number,
  ) {
    if (routeModuleUnitId === payloadModuleUnitId) {
      return;
    }
    throw new BadRequestException(
      'Submitted module unit does not match the current route.',
    );
  }

  // Session ownership and module linkage are validated before writes so students cannot attach attempts to foreign sessions.
  private async validateSession(
    moduleId: number,
    studentId: number,
    sessionId: number,
  ) {
    const session = await this.prisma.practiceSession.findFirst({
      where: {
        id: sessionId,
        moduleId,
        userId: studentId,
      },
      select: { id: true },
    });

    if (session) {
      return;
    }

    throw new NotFoundException('Practice session not found for this module.');
  }

  // We verify the submitted content belongs to the submitted question unit in this module unit before creating an attempt.
  private async validateQuestionContent(
    moduleUnitId: number,
    questionUnitId: number,
    questionContentId: number,
  ) {
    const questionUnit = await this.prisma.questionUnit.findFirst({
      where: {
        id: questionUnitId,
        moduleUnitId,
        isArchived: false,
      },
      select: {
        id: true,
        contents: {
          where: {
            id: questionContentId,
            isArchived: false,
          },
          select: { id: true },
        },
        variants: {
          where: {
            contentId: questionContentId,
            content: {
              isArchived: false,
            },
          },
          select: { id: true },
        },
      },
    });

    if (!questionUnit) {
      throw new NotFoundException('Question unit not found.');
    }

    if (questionUnit.contents.length > 0 || questionUnit.variants.length > 0) {
      return;
    }

    throw new NotFoundException(
      'Question content not found for this question unit.',
    );
  }

  // This is used for first-correct rules: once true, future correct submissions for the unit should not re-award XP.
  private async hasAnyCorrectAttempt(
    moduleUnitId: number,
    studentId: number,
    questionUnitId: number,
  ): Promise<boolean> {
    const correctAttempt = await this.prisma.questionAttempt.findFirst({
      where: {
        moduleUnitId,
        studentId,
        questionId: questionUnitId,
        isCorrect: true,
      },
      select: { id: true },
    });

    return Boolean(correctAttempt);
  }

  // Keeping attempt persistence isolated makes it easier to swap in a transaction once XP/difficulty writes are added.
  private createAttemptRecord(
    moduleUnitId: number,
    studentId: number,
    payload: SubmitAttemptDto,
  ) {
    return this.prisma.questionAttempt.create({
      data: {
        moduleUnitId,
        studentId,
        questionId: payload.questionUnitId,
        contentId: payload.questionContentId,
        sessionId: payload.sessionId,
        practiceMode: payload.practiceMode,
        isCorrect: payload.isCorrect,
        timeTakenMs: payload.timeTakenMs,
        hintsUsed: payload.hintUnlocked ? 1 : 0,
        studentAnswer:
          payload.studentAnswer as unknown as Prisma.InputJsonValue,
        attemptedAt: new Date(),
      },
      select: { id: true },
    });
  }
}
