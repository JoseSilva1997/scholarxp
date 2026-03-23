/* Service role: owns attempt validation, grading, and persistence details so
 the facade can coordinate submit flows without embedding answer-policy logic.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AwardReasons, StudentAnswer } from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

type AttemptQuestionContent = {
  type: string;
  questionData: Prisma.JsonValue;
};

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class PracticeRoomAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  // Route params remain the source of truth, so payload moduleUnitId must match to prevent accidental cross-unit writes.
  validateModuleUnitPayload(
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

  // Correctness is computed from persisted question config so clients cannot spoof correctness flags.
  async computeIsCorrectForPayload(
    moduleUnitId: number,
    questionUnitId: number,
    questionContentId: number,
    studentAnswer: StudentAnswer,
  ): Promise<boolean> {
    const questionContent = await this.loadQuestionContentForAttempt(
      moduleUnitId,
      questionUnitId,
      questionContentId,
    );

    return this.computeIsCorrectFromContent(questionContent, studentAnswer);
  }

  // Reward reasons stay backend-owned so clients can render copy without duplicating XP policy rules.
  resolveSubmitAwardReasons(params: {
    isCorrect: boolean;
    hadAnyAttemptBeforeSubmit: boolean;
    hintUnlockedOnSubmit: boolean;
    moduleAwards: {
      baseQuestionExp: number;
      firstAttemptBonus: number;
    };
  }): AwardReasons {
    const baseQuestionExp = !params.isCorrect
      ? 'incorrect'
      : params.moduleAwards.baseQuestionExp > 0
        ? 'awarded'
        : 'already_earned';

    const firstAttemptBonus = !params.isCorrect
      ? 'incorrect'
      : params.moduleAwards.firstAttemptBonus > 0
        ? 'awarded'
        : params.hadAnyAttemptBeforeSubmit
          ? 'not_first_try'
          : params.hintUnlockedOnSubmit
            ? 'hint_used'
            : 'already_earned';

    return {
      baseQuestionExp,
      firstAttemptBonus,
    };
  }

  // This lookup supports first-correct XP rules so future correct attempts do not re-award question XP.
  async hasAnyCorrectAttempt(
    moduleUnitId: number,
    studentId: number,
    questionUnitId: number,
    tx?: PrismaClientLike,
  ): Promise<boolean> {
    const prismaClient = tx ?? this.prisma;
    const correctAttempt = await prismaClient.questionAttempt.findFirst({
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

  // First-attempt bonus needs a canonical answer to whether the student has tried this question before.
  async hasAnyAttempt(
    moduleUnitId: number,
    studentId: number,
    questionUnitId: number,
    tx?: PrismaClientLike,
  ): Promise<boolean> {
    const prismaClient = tx ?? this.prisma;
    const existingAttempt = await prismaClient.questionAttempt.findFirst({
      where: {
        moduleUnitId,
        studentId,
        questionId: questionUnitId,
      },
      select: { id: true },
    });

    return Boolean(existingAttempt);
  }

  // Adaptive review state should update once per session encounter, so lesson and retry flows need a session-scoped attempt lookup in addition to the historical lookup used by XP.
  async hasAnySessionAttempt(
    moduleUnitId: number,
    studentId: number,
    questionUnitId: number,
    sessionId: string,
    tx?: PrismaClientLike,
  ): Promise<boolean> {
    const prismaClient = tx ?? this.prisma;
    const existingAttempt = await prismaClient.questionAttempt.findFirst({
      where: {
        moduleUnitId,
        studentId,
        questionId: questionUnitId,
        sessionId,
      },
      select: { id: true },
    });

    return Boolean(existingAttempt);
  }

  // Attempt persistence is isolated so the submit workflow can stay focused on transaction sequencing.
  createAttemptRecord(
    moduleUnitId: number,
    studentId: number,
    payload: SubmitAttemptDto,
    isCorrect: boolean,
    attemptedAt: Date,
    tx?: PrismaClientLike,
  ) {
    const prismaClient = tx ?? this.prisma;
    return prismaClient.questionAttempt.create({
      data: {
        moduleUnitId,
        studentId,
        questionId: payload.questionUnitId,
        contentId: payload.questionContentId,
        sessionId: payload.sessionId,
        isCorrect,
        timeTakenMs: payload.timeTakenMs,
        hintsUsed: payload.hintUnlocked ? 1 : 0,
        studentAnswer:
          payload.studentAnswer as unknown as Prisma.InputJsonValue,
        attemptedAt,
      },
      select: { id: true },
    });
  }

  // We verify content ownership and return canonical question config needed for backend-owned grading.
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
            isCore: true,
            isArchived: false,
          },
          select: {
            id: true,
            type: true,
            questionData: true,
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

    throw new NotFoundException(
      'Question content not found for this question unit.',
    );
  }

  // Shared grading protects submit flows from client-side correctness tampering.
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
}
