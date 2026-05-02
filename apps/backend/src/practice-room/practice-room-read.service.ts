/* Service role: owns practice-room read models and lookup rules so the facade
 can assemble room payloads without embedding Prisma-heavy query logic.
 */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole, ModuleUnitStatus } from '@prisma/client';
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
    globalRole?: GlobalRole,
  ): Promise<RoomContext> {
    const moduleUnit = await this.getModuleUnitOrThrow(
      moduleId,
      moduleUnitId,
      globalRole,
    );
    const isCompleted = await this.isModuleUnitCompleted(
      moduleUnitId,
      studentId,
    );
    const resolvedSessionType = this.resolveEntrySessionType(
      isCompleted,
      requestedSessionType,
    );
    const session = await this.resolveRoomSessionForEntry({
      moduleId,
      studentId,
      sessionType: resolvedSessionType,
      existingSessionId,
    });

    return {
      moduleUnit,
      isReadOnly: resolvedSessionType === PracticeSessionTypeValues.viewAnswers,
      session,
      questionUnitDrafts:
        this.practiceRoomMapper.toQuestionUnitDrafts(moduleUnit),
    };
  }

  // Loads module-unit content in one query to avoid round-trips while building the room payload.
  // Students only see live units; draft/locked/archived stay invisible to prevent URL-direct access bypass.
  async getModuleUnitOrThrow(
    moduleId: number,
    moduleUnitId: number,
    globalRole?: GlobalRole,
  ): Promise<LoadedModuleUnit> {
    const restrictToLive = globalRole === GlobalRole.student;
    const moduleUnit = await this.prisma.moduleUnit.findFirst({
      where: {
        id: moduleUnitId,
        moduleId,
        ...(restrictToLive ? { status: ModuleUnitStatus.live } : {}),
      },
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

    // Retry replays the active retry session only, while viewAnswers should reveal
    // the completed lesson's historical practice answers instead of the empty review session.
    const isSessionIdScoped =
      sessionType === PracticeSessionTypeValues.retry && sessionId;

    const latestAttempts =
      questionUnitIds.length === 0 || contentIds.length === 0
        ? []
        : await this.prisma.questionAttempt.findMany({
            where: {
              moduleUnitId,
              studentId,
              ...(isSessionIdScoped
                ? { sessionId }
                : sessionType === PracticeSessionTypeValues.viewAnswers
                  ? {
                      session: {
                        sessionType: PracticeSessionTypeValues.practiceRoom,
                      },
                    }
                  : sessionType
                    ? { session: { sessionType } }
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
        // Reward indicators describe lesson XP eligibility, so daily-practice history must stay out of this read.
        session: {
          sessionType: PracticeSessionTypeValues.practiceRoom,
        },
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
    globalRole?: GlobalRole,
  ) {
    if (globalRole === GlobalRole.student) {
      const unit = await this.prisma.moduleUnit.findUnique({
        where: { id: moduleUnitId },
        select: { status: true },
      });
      if (!unit || unit.status !== ModuleUnitStatus.live) {
        throw new ForbiddenException('This lesson is not available.');
      }
    }

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

  // Completion can refetch the room while the URL still carries the old
  // practice-room session id, so mismatched session ids must not override the
  // newly required room mode.
  // Recovery pattern: if the caller provided a session id that belongs to a different
  // session type (e.g. an old practice_room session id arriving when the unit is now
  // complete and needs a viewAnswers session), the ForbiddenException from type-mismatch
  // is caught and the lookup retries without the stale id, allowing the correct session
  // type to be resolved or created. Other errors are re-thrown unchanged.
  private async resolveRoomSessionForEntry(input: {
    moduleId: number;
    studentId: number;
    sessionType: PracticeSessionType;
    existingSessionId?: string;
  }) {
    try {
      return await this.practiceRoomSessionService.resolveOwnedSessionByType(
        input.moduleId,
        input.studentId,
        input.sessionType,
        input.existingSessionId,
      );
    } catch (error) {
      if (
        error instanceof ForbiddenException &&
        input.existingSessionId !== undefined
      ) {
        return this.practiceRoomSessionService.resolveOwnedSessionByType(
          input.moduleId,
          input.studentId,
          input.sessionType,
        );
      }
      throw error;
    }
  }
}
