/* Test role: verifies PracticeRoomSessionService owns session lifecycle rules
 after the orchestration refactor split persistence from the facade.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import { PracticeRoomSessionService } from './practice-session.service';
import {
  buildOwnedPracticeSession,
  TEST_MODULE_ID,
  TEST_SESSION_ID,
  TEST_STUDENT_ID,
} from './practice-room.test-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';

describe('PracticeRoomSessionService', () => {
  let service: PracticeRoomSessionService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeRoomSessionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PracticeRoomSessionService>(
      PracticeRoomSessionService,
    );
  });

  describe('resolveRoomSession', () => {
    it('reuses an existing session when the caller provides one', async () => {
      const existingSession = buildOwnedPracticeSession();
      const ownedSessionSpy = jest
        .spyOn(service, 'getOwnedPracticeSessionOrThrow')
        .mockResolvedValue(existingSession);

      const result = await service.resolveRoomSession(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.practiceRoom,
        existingSession.id,
      );

      expect(ownedSessionSpy).toHaveBeenCalledWith(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        existingSession.id,
      );
      expect(result).toBe(existingSession);
    });

    it('creates a read-only view session when the room is read only', async () => {
      prisma.practiceSession.create.mockResolvedValue({
        id: TEST_SESSION_ID,
        sessionType: PracticeSessionTypeValues.viewAnswers,
        endTime: null,
      } as never);

      const result = await service.resolveRoomSession(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.viewAnswers,
      );

      expect(prisma.practiceSession.create).toHaveBeenCalledWith({
        data: {
          moduleId: TEST_MODULE_ID,
          userId: TEST_STUDENT_ID,
          sessionType: PracticeSessionTypeValues.viewAnswers,
          startTime: expect.any(Date),
        },
        select: { id: true, sessionType: true, endTime: true },
      });
      expect(result.sessionType).toBe(PracticeSessionTypeValues.viewAnswers);
    });

    it('creates retry sessions when the caller explicitly requests retry mode', async () => {
      prisma.practiceSession.create.mockResolvedValue({
        id: TEST_SESSION_ID,
        sessionType: PracticeSessionTypeValues.retry,
        endTime: null,
      } as never);

      const result = await service.resolveRoomSession(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.retry,
      );

      expect(prisma.practiceSession.create).toHaveBeenCalledWith({
        data: {
          moduleId: TEST_MODULE_ID,
          userId: TEST_STUDENT_ID,
          sessionType: PracticeSessionTypeValues.retry,
          startTime: expect.any(Date),
        },
        select: { id: true, sessionType: true, endTime: true },
      });
      expect(result.sessionType).toBe(PracticeSessionTypeValues.retry);
    });
  });

  describe('resolveOwnedSessionByType', () => {
    it('reuses an open matching session before creating a new one', async () => {
      const openSession = buildOwnedPracticeSession({
        sessionType: PracticeSessionTypeValues.dailyPractice,
      });
      const findOpenSessionSpy = jest
        .spyOn(service, 'findOwnedOpenPracticeSessionByType')
        .mockResolvedValue(openSession);

      const result = await service.resolveOwnedSessionByType(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.dailyPractice,
      );

      expect(findOpenSessionSpy).toHaveBeenCalledWith(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        PracticeSessionTypeValues.dailyPractice,
      );
      expect(result).toBe(openSession);
      expect(prisma.practiceSession.create).not.toHaveBeenCalled();
    });

    it('validates a provided session id matches the requested session type', async () => {
      jest.spyOn(service, 'getOwnedPracticeSessionOrThrow').mockResolvedValue(
        buildOwnedPracticeSession({
          sessionType: PracticeSessionTypeValues.practiceRoom,
        }),
      );

      await expect(
        service.resolveOwnedSessionByType(
          TEST_MODULE_ID,
          TEST_STUDENT_ID,
          PracticeSessionTypeValues.dailyPractice,
          TEST_SESSION_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getOwnedPracticeSessionOrThrow', () => {
    it('throws when the session does not belong to the module and student', async () => {
      prisma.practiceSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getOwnedPracticeSessionOrThrow(
          TEST_MODULE_ID,
          TEST_STUDENT_ID,
          TEST_SESSION_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertSessionAllowsSubmissions', () => {
    it('blocks view-answer sessions from accepting new attempts', () => {
      expect(() =>
        service.assertSessionAllowsSubmissions(
          PracticeSessionTypeValues.viewAnswers,
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('closeOwnedSession', () => {
    it('closes an open session and returns the close timestamp', async () => {
      const ownedSessionSpy = jest
        .spyOn(service, 'getOwnedPracticeSessionOrThrow')
        .mockResolvedValue(buildOwnedPracticeSession());
      prisma.practiceSession.updateMany.mockResolvedValue({
        count: 1,
      } as never);

      const result = await service.closeOwnedSession(
        TEST_MODULE_ID,
        TEST_STUDENT_ID,
        TEST_SESSION_ID,
      );

      expect(ownedSessionSpy).toHaveBeenCalled();
      expect(prisma.practiceSession.updateMany).toHaveBeenCalledWith({
        where: {
          id: TEST_SESSION_ID,
          moduleId: TEST_MODULE_ID,
          userId: TEST_STUDENT_ID,
          endTime: null,
        },
        data: { endTime: expect.any(Date) },
      });
      expect(result.sessionId).toBe(TEST_SESSION_ID);
    });
  });

  describe('closeStaleSessions', () => {
    it('closes sessions stale by last attempt or by start time fallback', async () => {
      const now = new Date('2026-03-14T12:00:00.000Z');
      prisma.practiceSession.findMany.mockResolvedValue([
        {
          id: 'stale-by-start',
          startTime: new Date('2026-03-14T09:00:00.000Z'),
          questionAttempts: [],
        },
        {
          id: 'stale-by-attempt',
          startTime: new Date('2026-03-14T11:30:00.000Z'),
          questionAttempts: [{ attemptedAt: new Date('2026-03-14T10:30:00Z') }],
        },
        {
          id: 'fresh',
          startTime: new Date('2026-03-14T11:45:00.000Z'),
          questionAttempts: [{ attemptedAt: new Date('2026-03-14T11:50:00Z') }],
        },
      ] as never);
      prisma.practiceSession.updateMany.mockResolvedValue({
        count: 2,
      } as never);

      const result = await service.closeStaleSessions({
        now,
        inactivityMinutes: 60,
      });

      expect(prisma.practiceSession.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['stale-by-start', 'stale-by-attempt'] },
          endTime: null,
        },
        data: { endTime: now },
      });
      expect(result).toEqual({ closedCount: 2 });
    });

    it('returns zero when no stale sessions match the cutoff', async () => {
      prisma.practiceSession.findMany.mockResolvedValue([
        {
          id: 'fresh',
          startTime: new Date('2026-03-14T11:30:00.000Z'),
          questionAttempts: [{ attemptedAt: new Date('2026-03-14T11:45:00Z') }],
        },
      ] as never);

      await expect(
        service.closeStaleSessions({
          now: new Date('2026-03-14T12:00:00.000Z'),
          inactivityMinutes: 60,
        }),
      ).resolves.toEqual({ closedCount: 0 });
      expect(prisma.practiceSession.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('closeSessionOnCompletionIfNeeded', () => {
    it('writes the end time only when the unit became completed', async () => {
      const tx = createPrismaMock();
      const attemptedAt = new Date('2026-03-14T12:00:00.000Z');
      tx.practiceSession.updateMany.mockResolvedValue({ count: 1 } as never);

      await service.closeSessionOnCompletionIfNeeded(
        TEST_SESSION_ID,
        attemptedAt,
        true,
        tx,
      );

      expect(tx.practiceSession.updateMany).toHaveBeenCalledWith({
        where: {
          id: TEST_SESSION_ID,
          endTime: null,
        },
        data: { endTime: attemptedAt },
      });
    });
  });
});
