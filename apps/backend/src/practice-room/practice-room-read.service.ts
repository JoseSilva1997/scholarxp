/* Service role: owns practice-room read models and lookup rules so the facade
 can assemble room payloads without embedding Prisma-heavy query logic.
 */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PracticeSessionTypeValues,
  type PracticeQuestionRewardState,
  type PracticeSessionType,
} from '@scholarxp/api-contracts';
import {
  ExpLedgerEventTypes,
  MODULE_UNIT_BASELINE_EXP,
} from '@scholarxp/constants';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeRoomMapper } from './practice-room.mapper';
import { PracticeRoomSessionService } from './practice-session.service';
import type {
  LatestAttemptSnapshot,
  LoadedModuleUnit,
  RoomContext,
  RoomQuestionUnitDraft,
} from './practice-room.types';

@Injectable()
export class PracticeRoomReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practiceRoomMapper: PracticeRoomMapper,
    private readonly practiceRoomSessionService: PracticeRoomSessionService,
  ) {}

  // Grouping room dependencies keeps the facade focused on response assembly instead of lookup sequencing.
  async loadRoomContext(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
    requestedSessionType?: PracticeSessionType,
    existingSessionId?: string,
  ): Promise<RoomContext> {
    const moduleUnit = await this.getModuleUnitOrThrow(moduleId, moduleUnitId);
    const isCompleted = await this.isModuleUnitCompleted(
      moduleUnitId,
      studentId,
    );
    const resolvedSessionType = this.resolveEntrySessionType(
      isCompleted,
      requestedSessionType,
    );
    const session = await this.practiceRoomSessionService.resolveRoomSession(
      moduleId,
      studentId,
      resolvedSessionType,
      existingSessionId,
    );

    return {
      moduleUnit,
      isReadOnly: resolvedSessionType === PracticeSessionTypeValues.viewAnswers,
      session,
      questionUnitDrafts:
        this.practiceRoomMapper.toQuestionUnitDrafts(moduleUnit),
    };
  }

  // Loads module-unit content in one query to avoid round-trips while building the room payload.
  async getModuleUnitOrThrow(
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

    if (moduleUnit) {
      return moduleUnit;
    }

    throw new NotFoundException('Module unit not found');
  }

  // Encapsulates latest-attempt lookup and mapping so the facade only coordinates high-level room assembly.
  async getLatestAttemptMap(
    moduleUnitId: number,
    studentId: number,
    questionUnitDrafts: RoomQuestionUnitDraft[],
    sessionId?: string,
    sessionType?: PracticeSessionType,
  ) {
    return this.practiceRoomMapper.toLatestAttemptMap(
      await this.getLatestAttempts(
        moduleUnitId,
        studentId,
        questionUnitDrafts,
        sessionId,
        sessionType,
      ),
    );
  }

  // Fetches attempts once so the mapper can derive latest-per-content snapshots in one place.
  async getLatestAttempts(
    moduleUnitId: number,
    studentId: number,
    questionUnitDrafts: RoomQuestionUnitDraft[],
    sessionId?: string,
    sessionType?: PracticeSessionType,
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
              ...(sessionType === PracticeSessionTypeValues.retry && sessionId
                ? { sessionId }
                : {}),
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

  // Fetches the student's module progression once and shapes it for the shared contract payload.
  async getModuleProgressSnapshot(moduleId: number, studentId: number) {
    const membership = await this.prisma.userModule.findUnique({
      where: { moduleId_userId: { moduleId, userId: studentId } },
      include: { module: true },
    });

    if (!membership) {
      return undefined;
    }

    return {
      id: membership.moduleId,
      title: membership.module.title,
      description: membership.module.description,
      userModuleLevel: membership.userModuleLevel,
      currentExp: membership.currentExp,
      // Shared constants keep frontend progress rendering aligned with backend leveling rules.
      expMax: MODULE_UNIT_BASELINE_EXP,
    };
  }

  // Build per-question reward availability from canonical attempt history so the UI can explain XP outcomes on room load.
  async getQuestionRewardStateMap(
    moduleUnitId: number,
    studentId: number,
    questionUnitDrafts: RoomQuestionUnitDraft[],
  ): Promise<Map<number, PracticeQuestionRewardState>> {
    const questionUnitIds = questionUnitDrafts.map(
      (questionUnit) => questionUnit.questionUnitId,
    );
    if (questionUnitIds.length === 0) {
      return new Map<number, PracticeQuestionRewardState>();
    }

    const attempts = await this.prisma.questionAttempt.findMany({
      where: {
        moduleUnitId,
        studentId,
        questionId: { in: questionUnitIds },
      },
      orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
      select: {
        questionId: true,
        isCorrect: true,
        hintsUsed: true,
      },
    });

    return this.reduceQuestionRewardStateFromAttempts(attempts);
  }

  // Parse persisted streak reward events to expose already-claimed tiers without requiring a new schema field.
  async getClaimedStreakTiers(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
  ): Promise<number[]> {
    const streakEvents = await this.prisma.expLedger.findMany({
      where: {
        userId: studentId,
        moduleId,
        moduleUnitId,
        eventType: ExpLedgerEventTypes.PRACTICE_ROOM_STREAK,
      },
      select: {
        idempotencyKey: true,
      },
    });

    const claimedTierSet = new Set<number>();
    for (const event of streakEvents) {
      const tier = this.readStreakTierFromIdempotencyKey(event.idempotencyKey);
      if (tier !== null) {
        claimedTierSet.add(tier);
      }
    }

    return [...claimedTierSet].sort((left, right) => left - right);
  }

  // Completed module units are read-only so "view answers" entry points cannot create new attempts.
  async assertModuleUnitAllowsSubmissions(
    moduleUnitId: number,
    studentId: number,
    sessionType: string,
  ) {
    if (sessionType === PracticeSessionTypeValues.retry) {
      return;
    }

    if (await this.isModuleUnitCompleted(moduleUnitId, studentId)) {
      throw new ForbiddenException(
        'This unit is completed. Viewing answers is read-only.',
      );
    }
  }

  // Completion is read directly from persisted progress so UI and submit rules share one backend source of truth.
  async isModuleUnitCompleted(moduleUnitId: number, studentId: number) {
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

  // One pass over sorted attempts keeps reward-state derivation deterministic and easy to unit-test.
  reduceQuestionRewardStateFromAttempts(
    attempts: Array<{
      questionId: number;
      isCorrect: boolean;
      hintsUsed: number;
    }>,
  ): Map<number, PracticeQuestionRewardState> {
    const rewardStateByQuestionId = new Map<
      number,
      PracticeQuestionRewardState
    >();

    for (const attempt of attempts) {
      const existingState =
        rewardStateByQuestionId.get(attempt.questionId) ??
        this.buildDefaultQuestionRewardState();
      const nextState = { ...existingState };

      if (existingState.firstAttemptBonusStatus === 'available') {
        // A hinted first attempt is assisted, so the first-try bonus is forfeited even when correct.
        nextState.firstAttemptBonusStatus =
          attempt.hintsUsed > 0
            ? 'lost'
            : attempt.isCorrect
              ? 'already_earned'
              : 'lost';
      }

      if (attempt.isCorrect) {
        nextState.baseQuestionExpStatus = 'already_earned';
      }

      rewardStateByQuestionId.set(attempt.questionId, nextState);
    }

    return rewardStateByQuestionId;
  }

  // Idempotency keys include ":tier:{n}"; extracting that suffix avoids schema changes for historical rows.
  private readStreakTierFromIdempotencyKey(
    idempotencyKey: string,
  ): number | null {
    const match = idempotencyKey.match(/:tier:(\d+)$/);
    if (!match) {
      return null;
    }

    const tier = Number(match[1]);
    return Number.isInteger(tier) && tier > 0 ? tier : null;
  }

  // Centralized defaults avoid repeating literal reward-state objects across lookup helpers.
  private buildDefaultQuestionRewardState(): PracticeQuestionRewardState {
    return {
      baseQuestionExpStatus: 'available',
      firstAttemptBonusStatus: 'available',
    };
  }

  // Completed lessons default to review mode unless the caller explicitly asks for retry.
  private resolveEntrySessionType(
    isCompleted: boolean,
    requestedSessionType?: PracticeSessionType,
  ): PracticeSessionType {
    if (!isCompleted) {
      return PracticeSessionTypeValues.practiceRoom;
    }

    if (requestedSessionType === PracticeSessionTypeValues.retry) {
      return PracticeSessionTypeValues.retry;
    }

    return PracticeSessionTypeValues.viewAnswers;
  }
}
