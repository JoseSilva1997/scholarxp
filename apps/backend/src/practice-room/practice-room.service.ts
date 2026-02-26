import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  PracticeSessionTypeValues,
  type PracticeSessionType,
  type StudentAnswer,
} from '@scholarxp/api-contracts';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { UserModuleService } from '../db-entities/user-module/user-module.service';
import { PrismaService } from '../prisma/prisma.service';
import { MODULE_EXP_MAX } from '@scholarxp/constants';
import { ModuleUnitPracticeRoomResponseDto } from './dto/practice-room-response.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';
import { PracticeRoomMapper } from './practice-room.mapper';
import { StudentModuleUnitProgressService } from './student-module-unit-progress.service';
import type {
  LatestAttemptSnapshot,
  LoadedModuleUnit,
  RoomQuestionUnitDraft,
} from './practice-room.types';

type AttemptQuestionContent = {
  type: string;
  questionData: Prisma.JsonValue;
};
type PrismaClientLike = Prisma.TransactionClient | PrismaService;
type OwnedPracticeSession = {
  id: string;
  sessionType: string;
  endTime: Date | null;
};
const MODULE_UNIT_EXP_REWARD = 50;
const STUDENT_EXP_REWARD = 25;
const DEFAULT_STALE_SESSION_MINUTES = 60;

// PracticeRoomService builds the page-load payload so the frontend can render core questions and latest attempts.
@Injectable()
export class PracticeRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practiceRoomMapper: PracticeRoomMapper,
    private readonly studentModuleUnitProgressService: StudentModuleUnitProgressService,
    private readonly avatarService: AvatarService,
    private readonly userModuleService: UserModuleService,
  ) {}

  // Builds the initial room state for one student in one module unit and either resumes a provided session or opens a fresh one.
  async getPracticeRoom(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
    existingSessionId?: string,
  ): Promise<ModuleUnitPracticeRoomResponseDto> {
    const moduleUnit = await this.getModuleUnitOrThrow(moduleId, moduleUnitId);
    const isReadOnly = await this.isModuleUnitCompleted(
      moduleUnitId,
      studentId,
    );
    const nextSessionType = isReadOnly
      ? PracticeSessionTypeValues.viewAnswers
      : PracticeSessionTypeValues.practiceRoom;
    const session =
      existingSessionId === undefined
        ? await this.createPracticeSession(moduleId, studentId, nextSessionType)
        : await this.getOwnedPracticeSessionOrThrow(
            moduleId,
            studentId,
            existingSessionId,
          );
    const questionUnitDrafts =
      this.practiceRoomMapper.toQuestionUnitDrafts(moduleUnit);
    const latestAttempts = await this.getLatestAttempts(
      moduleUnitId,
      studentId,
      questionUnitDrafts,
    );
    const latestAttemptByKey =
      this.practiceRoomMapper.toLatestAttemptMap(latestAttempts);

    // Fetch student's module progress in the same session to avoid extra round-trips for the frontend progress bar.
    const membership = await this.prisma.userModule.findUnique({
      where: { moduleId_userId: { moduleId, userId: studentId } },
      include: { module: true },
    });

    return this.practiceRoomMapper.buildResponse({
      sessionId: session.id,
      sessionType: normalizeSessionType(session.sessionType),
      moduleUnitId: moduleUnit.id,
      moduleUnitTitle: moduleUnit.title,
      isReadOnly,
      questionUnitDrafts,
      latestAttemptByKey,
      moduleProgress: membership
        ? {
            id: membership.moduleId,
            title: membership.module.title,
            description: membership.module.description,
            userModuleLevel: membership.userModuleLevel,
            currentExp: membership.currentExp,
            expMax: MODULE_EXP_MAX, // Default module expansion ceiling from global gamification rules.
          }
        : undefined,
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
    const session = await this.validateSession(
      moduleId,
      studentId,
      payload.sessionId,
    );
    this.assertSessionAllowsSubmissions(session.sessionType);
    await this.assertModuleUnitAllowsSubmissions(moduleUnitId, studentId);
    const attemptQuestionContent = await this.loadQuestionContentForAttempt(
      moduleUnitId,
      payload.questionUnitId,
      payload.questionContentId,
    );
    const isCorrect = this.computeIsCorrectFromContent(
      attemptQuestionContent,
      payload.studentAnswer,
    );

    const attemptedAt = new Date();
    const { alreadyHasCorrectAttempt, updatedMembership } =
      await this.prisma.$transaction(async (tx) => {
        const hadCorrectAttemptBeforeSubmit = await this.hasAnyCorrectAttempt(
          moduleUnitId,
          studentId,
          payload.questionUnitId,
          tx,
        );

        await this.createAttemptRecord(
          moduleUnitId,
          studentId,
          payload,
          isCorrect,
          attemptedAt,
          tx,
        );
        const syncedProgress =
          await this.studentModuleUnitProgressService.syncFromAttempts(
            {
              moduleUnitId,
              studentId,
              attemptedAt,
            },
            tx,
          );
        // Closing immediately on first completion
        if (syncedProgress.isCompleted) {
          await tx.practiceSession.updateMany({
            where: { id: payload.sessionId, endTime: null },
            data: { endTime: attemptedAt },
          });
        }
        const updatedMembership = await this.persistAttemptExpRewards(
          moduleId,
          studentId,
          tx,
        );

        return {
          alreadyHasCorrectAttempt: hadCorrectAttemptBeforeSubmit,
          updatedMembership,
        };
      });

    // Placeholder XP amounts unblock frontend progress until the real XP engine decides dynamic rewards.
    return {
      moduleExpAwarded: MODULE_UNIT_EXP_REWARD,
      studentExpAwarded: STUDENT_EXP_REWARD,
      hasCorrectAttempt: alreadyHasCorrectAttempt || isCorrect,
      updatedModuleProgress: updatedMembership
        ? {
            id: updatedMembership.moduleId,
            title: updatedMembership.module.title,
            description: updatedMembership.module.description,
            userModuleLevel: updatedMembership.userModuleLevel,
            currentExp: updatedMembership.currentExp,
            expMax: MODULE_EXP_MAX,
          }
        : undefined,
    };
  }

  // Idempotent close enables unload/navigation hooks to fire-and-forget without duplicate-close failures.
  async closeSession(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
    sessionId: string,
  ) {
    await this.getModuleUnitOrThrow(moduleId, moduleUnitId);
    const session = await this.getOwnedPracticeSessionOrThrow(
      moduleId,
      studentId,
      sessionId,
    );
    const closedAt = session.endTime ?? new Date();
    if (!session.endTime) {
      await this.prisma.practiceSession.updateMany({
        where: {
          id: sessionId,
          moduleId,
          userId: studentId,
          endTime: null,
        },
        data: { endTime: closedAt },
      });
    }
    return {
      sessionId,
      closedAt: closedAt.toISOString(),
    };
  }

  // Reconciles stale open sessions so abandoned tabs do not leave long-running sessions open indefinitely.
  async closeStaleSessions(params?: {
    now?: Date;
    inactivityMinutes?: number;
  }) {
    const now = params?.now ?? new Date();
    const inactivityMinutes = Math.max(
      1,
      params?.inactivityMinutes ?? DEFAULT_STALE_SESSION_MINUTES,
    );
    const cutoff = new Date(now.getTime() - inactivityMinutes * 60 * 1000);

    const openSessions = await this.prisma.practiceSession.findMany({
      where: { endTime: null },
      select: {
        id: true,
        startTime: true,
        questionAttempts: {
          orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { attemptedAt: true },
        },
      },
    });

    const staleSessionIds = openSessions
      .filter((session) => {
        const lastActivityAt = session.questionAttempts[0]?.attemptedAt;
        return (lastActivityAt ?? session.startTime) <= cutoff;
      })
      .map((session) => session.id);

    if (staleSessionIds.length === 0) {
      return { closedCount: 0 };
    }

    const result = await this.prisma.practiceSession.updateMany({
      where: {
        id: { in: staleSessionIds },
        endTime: null,
      },
      data: { endTime: now },
    });
    return { closedCount: result.count };
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
  private createPracticeSession(
    moduleId: number,
    studentId: number,
    sessionType: PracticeSessionType,
  ) {
    return this.prisma.practiceSession.create({
      data: {
        moduleId,
        userId: studentId,
        sessionType,
        // Starting a fresh session on room load provides a stable id for immediate UI wiring.
        startTime: new Date(),
      },
      select: { id: true, sessionType: true },
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
    const contentIds = questionUnitDrafts.map(
      (questionUnit) => questionUnit.coreContentId,
    );

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

  // Reward persistence stays in the same transaction as attempt creation to avoid partially applied progress.
  private async persistAttemptExpRewards(
    moduleId: number,
    studentId: number,
    tx: Prisma.TransactionClient,
  ) {
    const updatedMembership = await this.userModuleService.addStudentModuleExp(
      moduleId,
      studentId,
      MODULE_UNIT_EXP_REWARD,
      tx,
    );
    await this.avatarService.addStudentExp(studentId, STUDENT_EXP_REWARD, tx);

    // Reload with module include so we have title/description for the response mapper without extra queries.
    return tx.userModule.findUnique({
      where: { id: updatedMembership.id },
      include: { module: true },
    });
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
    sessionId: string,
  ) {
    return this.getOwnedPracticeSessionOrThrow(moduleId, studentId, sessionId);
  }

  // Submission permissions are session-type-aware so read-only "view answers" sessions cannot generate attempts.
  private assertSessionAllowsSubmissions(sessionType: string) {
    if (sessionType === PracticeSessionTypeValues.viewAnswers) {
      throw new ForbiddenException(
        'This session is read-only. Start a practice session to submit answers.',
      );
    }
  }

  // Completed module units are view-only; this prevents creating new attempts from "View answers" entry points.
  private async assertModuleUnitAllowsSubmissions(
    moduleUnitId: number,
    studentId: number,
  ) {
    if (await this.isModuleUnitCompleted(moduleUnitId, studentId)) {
      throw new ForbiddenException(
        'This unit is completed. Viewing answers is read-only.',
      );
    }
  }

  // Completion is read directly from persisted progress so UI and submit rules share one backend source of truth.
  private async isModuleUnitCompleted(moduleUnitId: number, studentId: number) {
    const progress = await this.prisma.moduleUnitUserProgress.findFirst({
      where: {
        moduleUnitId,
        studentId,
      },
      select: {
        isCompleted: true,
      },
    });
    return progress?.isCompleted === true;
  }

  // Session ownership checks are shared by room-load and submit paths so both flows enforce the same authorization boundary.
  private async getOwnedPracticeSessionOrThrow(
    moduleId: number,
    studentId: number,
    sessionId: string,
  ): Promise<OwnedPracticeSession> {
    const session = await this.prisma.practiceSession.findFirst({
      where: {
        id: sessionId,
        moduleId,
        userId: studentId,
      },
      select: { id: true, sessionType: true, endTime: true },
    });

    if (session) {
      return session;
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

  // Keeping attempt persistence isolated makes it easier to swap in a transaction once XP/difficulty writes are added.
  private createAttemptRecord(
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
}

function normalizeSessionType(value: string): PracticeSessionType {
  // Unknown persisted values fall back to practice_room so clients can render safely while preserving backward compatibility.
  const knownValues = Object.values(PracticeSessionTypeValues);
  if (knownValues.includes(value as (typeof knownValues)[number])) {
    return value as PracticeSessionType;
  }
  return PracticeSessionTypeValues.practiceRoom;
}
