/* Service role: orchestrates practice-room workflows by coordinating focused
 collaborators for reads, attempts, and session lifecycle management.
 */
import { Injectable } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import {
  PracticeSessionTypeValues,
  type PracticeSessionType,
} from '@scholarxp/api-contracts';
import { MODULE_UNIT_BASELINE_EXP } from '@scholarxp/constants';
import { DailyPracticeFsrsStateService } from '../daily-practice/daily-practice-fsrs-state.service';
import { ExpAwardingService } from '../exp-engine/exp-awarding.service';
import { ExpStreakService } from '../exp-engine/exp-streak.service';
import type { AttemptModuleExpRewardResult } from '../exp-engine/exp-engine.types';
import { PrismaService } from '../prisma/prisma.service';
import { QuestProgressService } from '../quests/quest-progress.service';
import { ModuleUnitPracticeRoomResponseDto } from './dto/practice-room-response.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';
import { PracticeRoomAttemptService } from './practice-room-attempt.service';
import { PracticeRoomMapper } from './practice-room.mapper';
import { PracticeRoomReadService } from './practice-room-read.service';
import { PracticeRoomSessionService } from './practice-session.service';
import { StudentModuleUnitProgressService } from './student-module-unit-progress.service';

@Injectable()
export class PracticeRoomService {
  constructor(
    private readonly practiceRoomReadService: PracticeRoomReadService,
    private readonly practiceRoomSessionService: PracticeRoomSessionService,
    private readonly practiceRoomAttemptService: PracticeRoomAttemptService,
    private readonly practiceRoomMapper: PracticeRoomMapper,
    private readonly studentModuleUnitProgressService: StudentModuleUnitProgressService,
    private readonly expAwardingService: ExpAwardingService,
    private readonly expStreakService: ExpStreakService,
    private readonly questProgressService: QuestProgressService,
    private readonly dailyPracticeFsrsStateService: DailyPracticeFsrsStateService,
    private readonly prisma: PrismaService,
  ) {}

  // Builds the initial room state for one student in one module unit and either resumes a provided session or opens a fresh one.
  async getPracticeRoom(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
    existingSessionId?: string,
    requestedSessionType?: PracticeSessionType,
    globalRole?: GlobalRole,
  ): Promise<ModuleUnitPracticeRoomResponseDto> {
    const roomContext = await this.practiceRoomReadService.loadRoomContext(
      moduleId,
      moduleUnitId,
      studentId,
      requestedSessionType,
      existingSessionId,
      globalRole,
    );
    const latestAttemptByKey =
      await this.practiceRoomReadService.getLatestAttemptMap(
        moduleUnitId,
        studentId,
        roomContext.questionUnitDrafts,
        roomContext.session.id,
        normalizeSessionType(roomContext.session.sessionType),
      );
    const moduleProgress =
      await this.practiceRoomReadService.getModuleProgressSnapshot(
        moduleId,
        studentId,
      );
    const questionRewardStateByQuestionId =
      await this.practiceRoomReadService.getQuestionRewardStateMap(
        moduleUnitId,
        studentId,
        roomContext.questionUnitDrafts,
      );
    const claimedStreakTiers =
      await this.practiceRoomReadService.getClaimedStreakTiers(
        moduleId,
        moduleUnitId,
        studentId,
      );
    const sessionType = normalizeSessionType(roomContext.session.sessionType);
    const retryReferenceHighestStreak =
      sessionType === PracticeSessionTypeValues.retry ||
      sessionType === PracticeSessionTypeValues.viewAnswers
        ? await this.expStreakService.getHistoricalHighestPracticeStreak(
            moduleUnitId,
            studentId,
          )
        : null;
    const { currentStreak, highestStreak } =
      retryReferenceHighestStreak !== null
        ? {
            currentStreak: retryReferenceHighestStreak,
            highestStreak: retryReferenceHighestStreak,
          }
        : await this.expStreakService.getSessionStreak(
            moduleUnitId,
            studentId,
            roomContext.session.id,
          );

    return this.practiceRoomMapper.buildResponse({
      sessionId: roomContext.session.id,
      sessionType,
      moduleUnitId: roomContext.moduleUnit.id,
      moduleUnitTitle: roomContext.moduleUnit.title,
      isReadOnly: roomContext.isReadOnly,
      questionUnitDrafts: roomContext.questionUnitDrafts,
      latestAttemptByKey,
      questionRewardStateByQuestionId,
      claimedStreakTiers,
      moduleProgress,
      currentStreak,
      highestStreak,
    });
  }

  // Persists one practice-room answer attempt and returns the XP outcome needed by the client.
  async submitAttempt(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
    payload: SubmitAttemptDto,
    globalRole?: GlobalRole,
  ): Promise<SubmitAttemptResponseDto> {
    this.practiceRoomAttemptService.validateModuleUnitPayload(
      moduleUnitId,
      payload.moduleUnitId,
    );
    const session =
      await this.practiceRoomSessionService.getOwnedPracticeSessionOrThrow(
        moduleId,
        studentId,
        payload.sessionId,
      );
    this.practiceRoomSessionService.assertSessionAllowsSubmissions(
      session.sessionType,
    );
    await this.practiceRoomReadService.assertModuleUnitAllowsSubmissions(
      moduleUnitId,
      studentId,
      session.sessionType,
      globalRole,
    );

    const isCorrect =
      await this.practiceRoomAttemptService.computeIsCorrectForPayload(
        moduleUnitId,
        payload.questionUnitId,
        payload.questionContentId,
        payload.studentAnswer,
      );
    const attemptedAt = new Date();

    const isRetrySession =
      session.sessionType === PracticeSessionTypeValues.retry;

    const {
      alreadyHasCorrectAttempt,
      hadAnyAttemptBeforeSubmit,
      updatedMembership,
      moduleAwards,
      awardedAccountExp,
    } = await this.prisma.$transaction(async (tx) => {
      const hadAnyAttemptBeforeSubmit =
        await this.practiceRoomAttemptService.hasAnyAttempt(
          moduleUnitId,
          studentId,
          payload.questionUnitId,
          tx,
        );
      const hadAnySessionAttemptBeforeSubmit =
        await this.practiceRoomAttemptService.hasAnySessionAttempt(
          moduleUnitId,
          studentId,
          payload.questionUnitId,
          payload.sessionId,
          tx,
        );
      const hadCorrectAttemptBeforeSubmit =
        await this.practiceRoomAttemptService.hasAnyCorrectAttempt(
          moduleUnitId,
          studentId,
          payload.questionUnitId,
          tx,
        );

      await this.practiceRoomAttemptService.createAttemptRecord(
        moduleUnitId,
        studentId,
        payload,
        isCorrect,
        attemptedAt,
        tx,
      );
      // Always feed encounters into the FSRS service so a late-correct attempt can still seed state after earlier wrong attempts in the same session. The state service guards against double-grading an already-seeded card via priorEncounterExists.
      const timezoneRow = await tx.user.findUnique({
        where: { id: studentId },
        select: { timezone: true },
      });
      const timezone = timezoneRow?.timezone ?? 'UTC';
      await this.dailyPracticeFsrsStateService.applyEncounter(
        {
          userId: studentId,
          moduleId,
          moduleUnitId,
          questionUnitId: payload.questionUnitId,
          reviewedAt: attemptedAt,
          firstAttemptCorrect: isCorrect,
          hintUnlocked: payload.hintUnlocked,
          timeTakenMs: payload.timeTakenMs,
          timezone,
          priorEncounterExists: hadAnySessionAttemptBeforeSubmit,
        },
        tx,
      );
      let updatedMembership: AttemptModuleExpRewardResult['updatedMembership'] =
        null;
      let moduleAwards: AttemptModuleExpRewardResult['moduleAwards'] = {
        baseQuestionExp: 0,
        firstAttemptBonus: 0,
        streakBonus: 0,
      };
      let awardedAccountExp = 0;

      if (!isRetrySession) {
        const syncedProgress =
          await this.studentModuleUnitProgressService.syncFromAttempts(
            {
              moduleUnitId,
              studentId,
              attemptedAt,
            },
            tx,
          );
        await this.practiceRoomSessionService.closeSessionOnCompletionIfNeeded(
          payload.sessionId,
          attemptedAt,
          syncedProgress.isCompleted,
          tx,
        );
        const rewardPersistence =
          await this.expAwardingService.awardAttemptModuleExp(
            {
              studentId,
              moduleId,
              moduleUnitId,
              sessionId: payload.sessionId,
              questionUnitId: payload.questionUnitId,
              isCorrect,
              hadCorrectAttemptBeforeSubmit,
              hadAnyAttemptBeforeSubmit,
              // Hint usage is policy input for first-try bonus eligibility.
              hintUnlockedOnSubmit: payload.hintUnlocked,
            },
            tx,
          );
        updatedMembership = rewardPersistence.updatedMembership;
        moduleAwards = rewardPersistence.moduleAwards;

        if (syncedProgress.isCompleted) {
          // Completion account XP is policy-owned by the reward service to keep the facade orchestration-only.
          awardedAccountExp = await this.expAwardingService.awardCompletionExp(
            {
              studentId,
              moduleId,
              moduleUnitId,
              sessionId: payload.sessionId,
              completedAt: attemptedAt,
            },
            tx,
          );
          await this.questProgressService.recordModuleUnitCompletion(
            {
              userId: studentId,
              moduleId,
              completedAt: attemptedAt,
            },
            tx,
          );
        }
      } else {
        await this.questProgressService.recordRetrySessionProgress(
          {
            userId: studentId,
            moduleId,
            moduleUnitId,
            sessionId: payload.sessionId,
            attemptedAt,
          },
          tx,
        );
      }

      return {
        alreadyHasCorrectAttempt: hadCorrectAttemptBeforeSubmit,
        hadAnyAttemptBeforeSubmit,
        updatedMembership,
        moduleAwards,
        awardedAccountExp,
      };
    });

    const retryReferenceHighestStreak = isRetrySession
      ? await this.expStreakService.getHistoricalHighestPracticeStreak(
          moduleUnitId,
          studentId,
        )
      : null;
    const { currentStreak, highestStreak } =
      retryReferenceHighestStreak !== null
        ? {
            currentStreak: retryReferenceHighestStreak,
            highestStreak: retryReferenceHighestStreak,
          }
        : await this.expStreakService.getSessionStreak(
            moduleUnitId,
            studentId,
            payload.sessionId,
          );

    return {
      awards: {
        baseQuestionExp: moduleAwards.baseQuestionExp,
        firstAttemptBonus: moduleAwards.firstAttemptBonus,
        streakBonus: moduleAwards.streakBonus,
        masteryExp: 0,
        accountExp: awardedAccountExp,
      },
      awardReasons: this.practiceRoomAttemptService.resolveSubmitAwardReasons({
        isCorrect,
        hadAnyAttemptBeforeSubmit,
        hintUnlockedOnSubmit: payload.hintUnlocked,
        moduleAwards,
      }),
      hasCorrectAttempt: alreadyHasCorrectAttempt || isCorrect,
      updatedModuleProgress: updatedMembership
        ? {
            id: updatedMembership.moduleId,
            title: updatedMembership.module.title,
            description: updatedMembership.module.description,
            userModuleLevel: updatedMembership.userModuleLevel,
            currentExp: updatedMembership.currentExp,
            expMax: MODULE_UNIT_BASELINE_EXP,
          }
        : undefined,
      currentStreak,
      highestStreak,
    };
  }

  // Idempotent close enables unload/navigation hooks to fire-and-forget without duplicate-close failures.
  async closeSession(
    moduleId: number,
    moduleUnitId: number,
    studentId: number,
    sessionId: string,
  ) {
    await this.practiceRoomReadService.getModuleUnitOrThrow(
      moduleId,
      moduleUnitId,
    );

    return this.practiceRoomSessionService.closeOwnedSession(
      moduleId,
      studentId,
      sessionId,
    );
  }

  // Stale-session cleanup stays on the facade because the sweep service already depends on this public contract.
  closeStaleSessions(params?: { now?: Date; inactivityMinutes?: number }) {
    return this.practiceRoomSessionService.closeStaleSessions(params);
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
