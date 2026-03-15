/* Service role: owns practice-session lifecycle rules so the facade can keep
 room workflows focused on coordination instead of session persistence details.
 */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  PracticeSessionTypeValues,
  type PracticeSessionType,
} from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { OwnedPracticeSession } from './practice-room.types';

const DEFAULT_STALE_SESSION_MINUTES = 60;

@Injectable()
export class PracticeRoomSessionService {
  constructor(private readonly prisma: PrismaService) {}

  // Session resolution centralizes "new vs resume" decisions so room entry remains consistent across callsites.
  async resolveRoomSession(
    moduleId: number,
    studentId: number,
    isReadOnly: boolean,
    existingSessionId?: string,
  ): Promise<OwnedPracticeSession> {
    if (existingSessionId) {
      return this.getOwnedPracticeSessionOrThrow(
        moduleId,
        studentId,
        existingSessionId,
      );
    }

    const sessionType = isReadOnly
      ? PracticeSessionTypeValues.viewAnswers
      : PracticeSessionTypeValues.practiceRoom;

    return this.createPracticeSession(moduleId, studentId, sessionType);
  }

  // Creating sessions in one place ensures every room flow gets the same persisted shape and defaults.
  createPracticeSession(
    moduleId: number,
    studentId: number,
    sessionType: PracticeSessionType,
  ): Promise<OwnedPracticeSession> {
    return this.prisma.practiceSession.create({
      data: {
        moduleId,
        userId: studentId,
        sessionType,
        // Starting a fresh session on room load gives the client a stable id before the first attempt.
        startTime: new Date(),
      },
      select: { id: true, sessionType: true, endTime: true },
    });
  }

  // Session ownership checks are shared by room-load and submit flows so both enforce the same authorization boundary.
  async getOwnedPracticeSessionOrThrow(
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

  // Submission permissions are session-type-aware so read-only sessions cannot generate new attempts.
  assertSessionAllowsSubmissions(sessionType: string) {
    if (sessionType === PracticeSessionTypeValues.viewAnswers) {
      throw new ForbiddenException(
        'This session is read-only. Start a practice session to submit answers.',
      );
    }
  }

  // Idempotent close lets unload/navigation hooks call this safely without race-sensitive retries.
  async closeOwnedSession(
    moduleId: number,
    studentId: number,
    sessionId: string,
  ) {
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

    const staleSessionIds = this.collectStaleSessionIds(openSessions, cutoff);
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

  // Keeping completion-close logic isolated avoids repeating updateMany details inside transactional submit flows.
  closeSessionOnCompletionIfNeeded(
    sessionId: string,
    attemptedAt: Date,
    isCompleted: boolean,
    tx: Prisma.TransactionClient,
  ) {
    if (!isCompleted) {
      return Promise.resolve();
    }

    return tx.practiceSession.updateMany({
      where: { id: sessionId, endTime: null },
      data: { endTime: attemptedAt },
    });
  }

  // Extracted stale-id selection keeps lifecycle methods focused on orchestration rather than filtering details.
  private collectStaleSessionIds(
    openSessions: Array<{
      id: string;
      startTime: Date;
      questionAttempts: Array<{ attemptedAt: Date }>;
    }>,
    cutoff: Date,
  ) {
    return openSessions
      .filter((session) => {
        const lastActivityAt = session.questionAttempts[0]?.attemptedAt;
        return (lastActivityAt ?? session.startTime) <= cutoff;
      })
      .map((session) => session.id);
  }
}
