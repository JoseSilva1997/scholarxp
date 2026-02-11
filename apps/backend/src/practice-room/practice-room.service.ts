import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { StudentAnswer } from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleUnitPracticeRoomResponseDto } from './dto/practice-room-response.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';
import { PracticeRoomMapper } from './practice-room.mapper';
import type {
  LatestAttemptSnapshot,
  LoadedModuleUnit,
  RoomQuestionUnitDraft,
} from './practice-room.types';

type AttemptQuestionContent = {
  type: string;
  questionData: Prisma.JsonValue;
};

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
  ): Promise<ModuleUnitPracticeRoomResponseDto> {
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
    const attemptQuestionContent = await this.loadQuestionContentForAttempt(
      moduleUnitId,
      payload.questionUnitId,
      payload.questionContentId,
    );
    const isCorrect = this.computeIsCorrectFromContent(
      attemptQuestionContent,
      payload.studentAnswer,
    );

    const alreadyHasCorrectAttempt = await this.hasAnyCorrectAttempt(
      moduleUnitId,
      studentId,
      payload.questionUnitId,
    );

    await this.createAttemptRecord(moduleUnitId, studentId, payload, isCorrect);

    // XP engine integration is intentionally deferred; this flag lets the future engine gate first-correct rewards.
    return {
      moduleExpAwarded: 0,
      studentExpAwarded: 0,
      hasCorrectAttempt: alreadyHasCorrectAttempt || isCorrect,
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

  // We verify content ownership and return question content needed for backend-owned correctness grading.
  private async loadQuestionContentForAttempt(
    moduleUnitId: number,
    questionUnitId: number,
    questionContentId: number,
  ): Promise<AttemptQuestionContent> {
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
          select: {
            id: true,
            type: true,
            questionData: true,
          },
        },
        variants: {
          where: {
            contentId: questionContentId,
            content: {
              isArchived: false,
            },
          },
          select: {
            content: {
              select: {
                id: true,
                type: true,
                questionData: true,
              },
            },
          },
        },
      },
    });

    if (!questionUnit) {
      throw new NotFoundException('Question unit not found.');
    }

    const directContent = questionUnit.contents[0];
    if (directContent) {
      return {
        type: directContent.type,
        questionData: directContent.questionData,
      };
    }

    const variantContent = questionUnit.variants[0]?.content;
    if (variantContent) {
      return {
        type: variantContent.type,
        questionData: variantContent.questionData,
      };
    }

    throw new NotFoundException(
      'Question content not found for this question unit.',
    );
  }

  // Correctness is computed from persisted question config so clients cannot spoof correctness flags.
  private computeIsCorrectFromContent(
    questionContent: AttemptQuestionContent,
    studentAnswer: StudentAnswer,
  ): boolean {
    const selectedOptionIndex = this.readSelectedOptionIndex(studentAnswer);
    if (questionContent.type === 'mcq') {
      return this.gradeMcq(questionContent.questionData, selectedOptionIndex);
    }
    if (questionContent.type === 'true-false') {
      return this.gradeTrueFalse(
        questionContent.questionData,
        selectedOptionIndex,
      );
    }
    throw new BadRequestException(
      'This question type is not supported for practice submissions yet.',
    );
  }

  // Shared answer-index extraction keeps MCQ and true/false grading rules aligned.
  private readSelectedOptionIndex(studentAnswer: StudentAnswer): number {
    if (!studentAnswer || typeof studentAnswer !== 'object') {
      throw new BadRequestException(
        'Submitted answer format is invalid for this question type.',
      );
    }
    const candidate = studentAnswer as { selectedOptionIndex?: unknown };
    if (typeof candidate.selectedOptionIndex !== 'number') {
      throw new BadRequestException(
        'Submitted answer format is invalid for this question type.',
      );
    }
    return candidate.selectedOptionIndex;
  }

  // MCQ grading uses persisted correct-option metadata; malformed question data is treated as a safe user-facing error.
  private gradeMcq(
    questionData: Prisma.JsonValue,
    selectedOptionIndex: number,
  ) {
    if (!questionData || typeof questionData !== 'object') {
      throw new BadRequestException('Question configuration is invalid.');
    }
    const candidate = questionData as { correctOptionIndex?: unknown };
    if (typeof candidate.correctOptionIndex !== 'number') {
      throw new BadRequestException('Question configuration is invalid.');
    }
    return selectedOptionIndex === candidate.correctOptionIndex;
  }

  // True/false grading enforces binary answer indexes and uses stored true/false correctness flags.
  private gradeTrueFalse(
    questionData: Prisma.JsonValue,
    selectedOptionIndex: number,
  ) {
    if (selectedOptionIndex !== 0 && selectedOptionIndex !== 1) {
      throw new BadRequestException(
        'Submitted answer format is invalid for this question type.',
      );
    }
    if (!questionData || typeof questionData !== 'object') {
      throw new BadRequestException('Question configuration is invalid.');
    }
    const candidate = questionData as {
      trueOption?: { isCorrect?: unknown };
      falseOption?: { isCorrect?: unknown };
    };
    if (
      !candidate.trueOption ||
      typeof candidate.trueOption !== 'object' ||
      !candidate.falseOption ||
      typeof candidate.falseOption !== 'object' ||
      typeof candidate.trueOption.isCorrect !== 'boolean' ||
      typeof candidate.falseOption.isCorrect !== 'boolean'
    ) {
      throw new BadRequestException('Question configuration is invalid.');
    }
    return selectedOptionIndex === 0
      ? candidate.trueOption.isCorrect
      : candidate.falseOption.isCorrect;
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
    isCorrect: boolean,
  ) {
    return this.prisma.questionAttempt.create({
      data: {
        moduleUnitId,
        studentId,
        questionId: payload.questionUnitId,
        contentId: payload.questionContentId,
        sessionId: payload.sessionId,
        practiceMode: payload.practiceMode,
        isCorrect,
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
