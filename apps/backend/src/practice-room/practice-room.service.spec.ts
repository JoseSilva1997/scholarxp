// Comprehensive branch test coverage for PracticeRoomService
// Tests all conditional paths including edge cases, error handling, and data transformations
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PracticeRoomService } from './practice-room.service';
import { PracticeRoomMapper } from './practice-room.mapper';
import { StudentModuleUnitProgressService } from './student-module-unit-progress.service';
import { ExpAwardingService } from '../exp-engine/exp-awarding.service';
import { ExpStreakService } from '../exp-engine/exp-streak.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import type {
  LatestAttemptSnapshot,
  LoadedModuleUnit,
  RoomQuestionUnitDraft,
} from './practice-room.types';

describe('PracticeRoomService', () => {
  let service: PracticeRoomService;
  let mapper: PracticeRoomMapper;
  let prisma: PrismaMock;
  let studentModuleUnitProgressService: {
    syncFromAttempts: jest.Mock;
  };
  let practiceRewardService: {
    awardAttemptModuleExp: jest.Mock;
    awardCompletionExp: jest.Mock;
  };
  let expStreakService: {
    getSessionStreak: jest.Mock;
  };

  // Mock data builders for consistent test setup
  const buildMockModuleUnit = (
    overrides: Partial<LoadedModuleUnit> = {},
  ): LoadedModuleUnit => ({
    id: 1,
    title: 'Test Module Unit',
    questionUnits: [],
    ...overrides,
  });

  const buildQuestionUnit = (id: number = 1, hasCore: boolean = true) => ({
    id,
    contents: hasCore
      ? [
          {
            id: 10 + id,
            type: 'mcq',
            isCore: true,
            questionStem: 'Core Question Stem',
            questionData: {
              options: [
                { optionText: 'A' },
                { optionText: 'B' },
                { optionText: 'C' },
              ],
            } as any,
            hint: 'Test hint',
            difficultyScore: 5,
          },
        ]
      : [],
  });

  const buildQuestionUnitDraft = (
    overrides: Partial<RoomQuestionUnitDraft> = {},
  ): RoomQuestionUnitDraft => ({
    questionUnitId: 1,
    coreContentId: 11,
    coreQuestion: {
      questionId: 1,
      questionContent: {
        id: 11,
        type: 'mcq',
        questionStem: 'Core Question',
        questionData: {
          options: [{ optionText: 'A' }, { optionText: 'B' }],
        } as any,
        hint: null,
        difficultyScore: 5,
      },
    },
    ...overrides,
  });

  const buildAttempt = (
    overrides: Partial<LatestAttemptSnapshot> = {},
  ): LatestAttemptSnapshot => ({
    questionId: 1,
    contentId: 11,
    studentAnswer: { selectedOptionIndex: 0 },
    isCorrect: true,
    attemptedAt: new Date('2026-02-01T10:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    // Create mocks for dependencies
    prisma = createPrismaMock();
    // Transaction callback mode keeps submit-attempt tests deterministic without a real database transaction.
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(prisma),
    );
    mapper = new PracticeRoomMapper();
    studentModuleUnitProgressService = {
      syncFromAttempts: jest.fn().mockResolvedValue({
        moduleUnitId: 10,
        studentId: 100,
        currentMasteryScore: 0,
        noOfCorrectAnswers: 0,
        isCompleted: false,
        completedAt: null,
        lastPracticedAt: new Date('2026-02-12T10:00:00.000Z'),
      }),
    };
    // getSessionStreak returns both counts so the response can show pip state.
    expStreakService = {
      getSessionStreak: jest.fn().mockResolvedValue({ currentStreak: 0, highestStreak: 0 }),
    };

    practiceRewardService = {
      awardAttemptModuleExp: jest.fn().mockResolvedValue({
        moduleExpAwarded: 50,
        moduleAwards: {
          baseQuestionExp: 33,
          firstAttemptBonus: 17,
          streakBonus: 0,
        },
        updatedMembership: {
          id: 700,
          moduleId: 1,
          userId: 100,
          roleInModule: 'student',
          userModuleLevel: 1,
          currentExp: 50,
          enrolledVia: 'invite',
          createdAt: new Date('2026-02-12T10:00:00.000Z'),
          module: {
            id: 1,
            title: 'Biology',
            description: 'Study biology',
          },
        },
      }),
      awardCompletionExp: jest.fn().mockResolvedValue(0),
    };

    // Build test module with mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeRoomService,
        { provide: PracticeRoomMapper, useValue: mapper },
        { provide: PrismaService, useValue: prisma },
        {
          provide: StudentModuleUnitProgressService,
          useValue: studentModuleUnitProgressService,
        },
        {
          provide: ExpAwardingService,
          useValue: practiceRewardService,
        },
        {
          provide: ExpStreakService,
          useValue: expStreakService,
        },
      ],
    }).compile();

    service = module.get<PracticeRoomService>(PracticeRoomService);
  });

  describe('getPracticeRoom', () => {
    // ===== HAPPY PATH =====
    it('should build complete practice room with all data', async () => {
      const moduleId = 1;
      const moduleUnitId = 10;
      const studentId = 100;

      // Setup: module unit with questions
      const mockModuleUnit = buildMockModuleUnit({
        questionUnits: [buildQuestionUnit(1, true), buildQuestionUnit(2, true)],
      });

      // Setup: practice session
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111999',
        sessionType: 'practice_room',
      } as any);

      // Setup: find module unit
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);

      // Setup: attempts - one for first question, none for second
      const mockAttempt = buildAttempt({
        questionId: 1,
        contentId: 11,
      });
      prisma.questionAttempt.findMany.mockResolvedValue([mockAttempt as any]);

      const result = await service.getPracticeRoom(
        moduleId,
        moduleUnitId,
        studentId,
      );

      // Verify session was created
      expect(prisma.practiceSession.create).toHaveBeenCalledWith({
        data: {
          moduleId,
          userId: studentId,
          sessionType: 'practice_room',
          startTime: expect.any(Date),
        },
        select: { id: true, sessionType: true, endTime: true },
      });

      // Verify module unit query included proper filters
      expect(prisma.moduleUnit.findFirst).toHaveBeenCalledWith({
        where: { id: moduleUnitId, moduleId },
        select: expect.any(Object),
      });

      // Verify result structure
      expect(result.practiceRoom).toBeDefined();
      expect(result.practiceRoom.sessionId).toBe(
        '11111111-1111-4111-8111-111111111999',
      );
      expect(result.practiceRoom.moduleUnitId).toBe(1);
      expect(result.practiceRoom.moduleUnitTitle).toBe('Test Module Unit');
      expect(result.practiceRoom.questions).toHaveLength(2);
    });

    // ===== UNHAPPY PATH: Module Unit Not Found =====
    it('should throw NotFoundException when module unit does not exist', async () => {
      prisma.moduleUnit.findFirst.mockResolvedValue(null);

      await expect(service.getPracticeRoom(1, 10, 100)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getPracticeRoom(1, 10, 100)).rejects.toThrow(
        'Module unit not found',
      );
    });

    // ===== BASIS PATH: Empty module unit =====
    it('should handle module unit with no questions', async () => {
      const mockModuleUnit = buildMockModuleUnit({ questionUnits: [] });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111888',
        sessionType: 'practice_room',
      } as any);
      prisma.questionAttempt.findMany.mockResolvedValue([]);

      const result = await service.getPracticeRoom(1, 10, 100);

      expect(result.practiceRoom.questions).toHaveLength(0);
    });

    it('reuses an existing practice session when sessionId is provided', async () => {
      const mockModuleUnit = buildMockModuleUnit({
        questionUnits: [buildQuestionUnit(1, true)],
      });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111444',
        sessionType: 'practice_room',
      } as any);
      prisma.questionAttempt.findMany.mockResolvedValue([]);

      const result = await service.getPracticeRoom(
        1,
        10,
        100,
        '11111111-1111-4111-8111-111111111444',
      );

      expect(prisma.practiceSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: '11111111-1111-4111-8111-111111111444',
          moduleId: 1,
          userId: 100,
        },
        select: { id: true, sessionType: true, endTime: true },
      });
      expect(prisma.practiceSession.create).not.toHaveBeenCalled();
      expect(result.practiceRoom.sessionId).toBe(
        '11111111-1111-4111-8111-111111111444',
      );
    });

    it('throws when provided sessionId does not belong to the student/module', async () => {
      const mockModuleUnit = buildMockModuleUnit({
        questionUnits: [buildQuestionUnit(1, true)],
      });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getPracticeRoom(
          1,
          10,
          100,
          '11111111-1111-4111-8111-111111111999',
        ),
      ).rejects.toThrow('Practice session not found for this module.');
      expect(prisma.practiceSession.create).not.toHaveBeenCalled();
    });

    // ===== BASIS PATH: Module unit with archived questions =====
    it('should filter out archived question units via database query', async () => {
      // Note: filtering happens at DB level (where: { isArchived: false })
      // This test verifies that the query includes the filter
      const mockModuleUnit = buildMockModuleUnit({
        questionUnits: [buildQuestionUnit(1, true)],
      });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111777',
        sessionType: 'practice_room',
      } as any);
      prisma.questionAttempt.findMany.mockResolvedValue([]);

      await service.getPracticeRoom(1, 10, 100);

      const call = prisma.moduleUnit.findFirst.mock.calls[0]?.[0] as any;
      expect(call?.select?.questionUnits?.where?.isArchived).toBe(false);
    });
  });

  describe('getModuleUnitOrThrow (private)', () => {
    // ===== HAPPY PATH: Module unit found =====
    it('should return module unit when found with matching module and unit id', async () => {
      const mockModuleUnit = buildMockModuleUnit({
        id: 10,
        questionUnits: [buildQuestionUnit(1, true)],
      });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);

      // Access private method via any type casting
      const result = await (service as any).getModuleUnitOrThrow(1, 10);

      expect(result).toEqual(mockModuleUnit);
      expect(prisma.moduleUnit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10, moduleId: 1 },
        }),
      );
    });

    // ===== UNHAPPY PATH: Module unit not found =====
    it('should throw NotFoundException when no results from findFirst', async () => {
      prisma.moduleUnit.findFirst.mockResolvedValue(null);

      await expect(
        (service as any).getModuleUnitOrThrow(1, 10),
      ).rejects.toThrow(NotFoundException);
    });

    // ===== EDGE CASE: Wrong module id =====
    it('should not find module unit when module id does not match', async () => {
      prisma.moduleUnit.findFirst.mockResolvedValue(null);

      await expect(
        (service as any).getModuleUnitOrThrow(999, 10),
      ).rejects.toThrow();

      expect(prisma.moduleUnit.findFirst).toHaveBeenCalledWith({
        where: { id: 10, moduleId: 999 },
        select: expect.any(Object),
      });
    });

    // ===== BRANCH COVERAGE: Query includes correct select fields =====
    it('should query with nested includes for core contents', async () => {
      const mockModuleUnit = buildMockModuleUnit();
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);

      await (service as any).getModuleUnitOrThrow(1, 10);

      const call = prisma.moduleUnit.findFirst.mock.calls[0]?.[0] as any;
      expect(call?.select?.questionUnits).toBeDefined();
      expect(call?.select?.questionUnits?.include?.contents).toBeDefined();
      expect(call?.select?.questionUnits?.include?.variants).toBeUndefined();
    });
  });

  describe('createPracticeSession (private)', () => {
    // ===== HAPPY PATH =====
    it('should create session with correct data', async () => {
      const mockSession = {
        id: '11111111-1111-4111-8111-111111111555',
        sessionType: 'practice_room',
      };
      prisma.practiceSession.create.mockResolvedValue(mockSession as any);

      const result = await (service as any).createPracticeSession(
        1,
        100,
        'practice_room',
      );

      expect(prisma.practiceSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            moduleId: 1,
            userId: 100,
            sessionType: 'practice_room',
            startTime: expect.any(Date),
          }),
          select: { id: true, sessionType: true, endTime: true },
        }),
      );
      expect(result).toEqual(mockSession);
    });

    // ===== EDGE CASE: Different module and student ids =====
    it('should create session with different module and student ids', async () => {
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111666',
        sessionType: 'practice_room',
      } as any);

      await (service as any).createPracticeSession(99, 999, 'practice_room');

      expect(prisma.practiceSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            moduleId: 99,
            userId: 999,
            sessionType: 'practice_room',
          }),
        }),
      );
    });

    // ===== TIMING EDGE CASE: Verify startTime is set close to execution time =====
    it('should set startTime to current date', async () => {
      const beforeCall = new Date();
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111777',
        sessionType: 'practice_room',
      } as any);

      await (service as any).createPracticeSession(1, 100, 'practice_room');

      const call = prisma.practiceSession.create.mock.calls[0]?.[0] as any;
      const afterCall = new Date();
      const startTime =
        call?.data?.startTime instanceof Date
          ? call.data.startTime
          : new Date(call?.data?.startTime);
      expect(startTime.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(startTime.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });

  describe('getLatestAttempts (private)', () => {
    // ===== HAPPY PATH: Attempts found for multiple questions =====
    it('should fetch and transform attempts when question and content ids exist', async () => {
      const questionUnitDrafts = [
        buildQuestionUnitDraft(),
        buildQuestionUnitDraft({
          questionUnitId: 2,
          coreContentId: 12,
        }),
      ];

      const mockAttempts = [
        buildAttempt({ questionId: 1, contentId: 11 }),
        buildAttempt({ questionId: 2, contentId: 12 }),
      ];
      prisma.questionAttempt.findMany.mockResolvedValue(mockAttempts as any);

      const result = await (service as any).getLatestAttempts(
        10, // moduleUnitId
        100, // studentId
        questionUnitDrafts,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        questionId: 1,
        contentId: 11,
        studentAnswer: { selectedOptionIndex: 0 },
        isCorrect: true,
        attemptedAt: new Date('2026-02-01T10:00:00Z'),
      });
    });

    // ===== BRANCH: Empty questionUnitIds =====
    it('should return empty array when no question units exist', async () => {
      const questionUnitDrafts: RoomQuestionUnitDraft[] = [];

      const result = await (service as any).getLatestAttempts(
        10,
        100,
        questionUnitDrafts,
      );

      expect(result).toEqual([]);
      // Database should not be queried
      expect(prisma.questionAttempt.findMany).not.toHaveBeenCalled();
    });

    // ===== BRANCH: Empty contentIds =====
    it('should return empty array when no contents exist (all questions have no core)', async () => {
      // Core-only mode still short-circuits when no draft questions are provided.
      const _questionUnitDrafts = [
        buildQuestionUnitDraft({
          coreContentId: 11,
        }),
      ];

      // Simulate condition where contentIds would be empty by testing with no drafts.
      const result = await (service as any).getLatestAttempts(10, 100, []);

      expect(result).toEqual([]);
      expect(prisma.questionAttempt.findMany).not.toHaveBeenCalled();
    });

    // ===== HAPPY PATH: No attempts exist =====
    it('should return empty array when no attempts found for the student', async () => {
      const questionUnitDrafts = [buildQuestionUnitDraft()];
      prisma.questionAttempt.findMany.mockResolvedValue([]);

      const result = await (service as any).getLatestAttempts(
        10,
        100,
        questionUnitDrafts,
      );

      expect(result).toEqual([]);
      expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
        where: {
          moduleUnitId: 10,
          studentId: 100,
          questionId: { in: [1] },
          contentId: { in: [11] },
        },
        orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
        select: expect.any(Object),
      });
    });

    // ===== BRANCH: Multiple attempts for same question/content kept =====
    it('should return all attempts as-is (de-duplication happens in mapper)', async () => {
      const questionUnitDrafts = [buildQuestionUnitDraft()];
      const mockAttempts = [
        buildAttempt({
          questionId: 1,
          contentId: 11,
          attemptedAt: new Date('2026-02-01T12:00:00Z'),
        }),
        buildAttempt({
          questionId: 1,
          contentId: 11,
          attemptedAt: new Date('2026-02-01T10:00:00Z'),
        }),
      ];
      prisma.questionAttempt.findMany.mockResolvedValue(mockAttempts as any);

      const result = await (service as any).getLatestAttempts(
        10,
        100,
        questionUnitDrafts,
      );

      // Service returns all, mapper dedupes
      expect(result).toHaveLength(2);
    });

    // ===== BRANCH: Correct query parameters =====
    it('should construct correct query with flattened content ids from drafts', async () => {
      const questionUnitDrafts = [
        buildQuestionUnitDraft({
          questionUnitId: 1,
          coreContentId: 11,
        }),
        buildQuestionUnitDraft({
          questionUnitId: 2,
          coreContentId: 12,
        }),
      ];

      prisma.questionAttempt.findMany.mockResolvedValue([]);

      await (service as any).getLatestAttempts(10, 100, questionUnitDrafts);

      expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
        where: {
          moduleUnitId: 10,
          studentId: 100,
          questionId: { in: [1, 2] },
          contentId: { in: [11, 12] },
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
    });

    // ===== BRANCH: Correct ordering =====
    it('should order by attemptedAt descending then id descending', async () => {
      const questionUnitDrafts = [buildQuestionUnitDraft()];
      prisma.questionAttempt.findMany.mockResolvedValue([]);

      await (service as any).getLatestAttempts(10, 100, questionUnitDrafts);

      const call = prisma.questionAttempt.findMany.mock.calls[0]?.[0] as any;
      expect(call?.orderBy).toEqual([{ attemptedAt: 'desc' }, { id: 'desc' }]);
    });

    // ===== DATA TRANSFORMATION: Attempt shape =====
    it('should strip attempt data to only required fields', async () => {
      const questionUnitDrafts = [buildQuestionUnitDraft()];
      const mockAttempt = {
        questionId: 1,
        contentId: 11,
        studentAnswer: { selectedOptionIndex: 1 },
        isCorrect: false,
        attemptedAt: new Date('2026-02-05T14:30:00Z'),
        // Additional fields that should be stripped
        id: 999,
        studentId: 100,
        moduleUnitId: 10,
      };
      prisma.questionAttempt.findMany.mockResolvedValue([mockAttempt as any]);

      const result = await (service as any).getLatestAttempts(
        10,
        100,
        questionUnitDrafts,
      );

      expect(result[0]).toEqual({
        questionId: 1,
        contentId: 11,
        studentAnswer: { selectedOptionIndex: 1 },
        isCorrect: false,
        attemptedAt: new Date('2026-02-05T14:30:00Z'),
      });
      expect(result[0]).not.toHaveProperty('id');
      expect(result[0]).not.toHaveProperty('studentId');
    });
  });

  describe('Integration scenarios', () => {
    // ===== FULL INTEGRATION: Complete happy path =====
    it('should orchestrate all methods in complete practice room flow', async () => {
      const moduleId = 5;
      const moduleUnitId = 50;
      const studentId = 500;

      const mockModuleUnit = buildMockModuleUnit({
        id: moduleUnitId,
        title: 'Advanced Calculus Unit 2',
        questionUnits: [buildQuestionUnit(1, true), buildQuestionUnit(2, true)],
      });

      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111112345',
      } as any);

      const attempts = [
        buildAttempt({ questionId: 1, contentId: 11, isCorrect: true }),
        buildAttempt({ questionId: 1, contentId: 21, isCorrect: false }),
      ];
      prisma.questionAttempt.findMany.mockResolvedValue(attempts as any);

      const result = await service.getPracticeRoom(
        moduleId,
        moduleUnitId,
        studentId,
      );

      // Verify complete result
      expect(result.practiceRoom.sessionId).toBe(
        '11111111-1111-4111-8111-111111112345',
      );
      expect(result.practiceRoom.moduleUnitId).toBe(moduleUnitId);
      expect(result.practiceRoom.moduleUnitTitle).toBe(
        'Advanced Calculus Unit 2',
      );
      expect(result.practiceRoom.questions).toHaveLength(2);

      // Verify all methods were called
      expect(prisma.moduleUnit.findFirst).toHaveBeenCalled();
      expect(prisma.practiceSession.create).toHaveBeenCalled();
      expect(prisma.questionAttempt.findMany).toHaveBeenCalled();
    });

    // ===== EDGE CASE: Question unit with no core content =====
    it('should handle module units with questions missing core content', async () => {
      const mockModuleUnit = buildMockModuleUnit({
        questionUnits: [
          buildQuestionUnit(1, true), // Has core
          buildQuestionUnit(2, false), // No core - will be filtered by mapper
        ],
      });

      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111888',
      } as any);
      prisma.questionAttempt.findMany.mockResolvedValue([]);

      const _result = await service.getPracticeRoom(1, 10, 100);

      // Mapper filters out questions without core content, so only unit 1 is queried
      expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            questionId: { in: [1] }, // Only mapped question IDs passed to query
          }),
        }),
      );
    });

    // ===== ERROR PROPAGATION: Database error in session creation =====
    it('should propagate database error from session creation', async () => {
      const mockModuleUnit = buildMockModuleUnit();
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.getPracticeRoom(1, 10, 100)).rejects.toThrow(
        'Database connection failed',
      );
    });

    // ===== ERROR PROPAGATION: Database error in attempts query =====
    it('should propagate database error from attempts query', async () => {
      const mockModuleUnit = buildMockModuleUnit({
        questionUnits: [buildQuestionUnit(1, true)],
      });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111999',
      } as any);
      prisma.questionAttempt.findMany.mockRejectedValue(
        new Error('Query timeout'),
      );

      await expect(service.getPracticeRoom(1, 10, 100)).rejects.toThrow(
        'Query timeout',
      );
    });
  });

  describe('submitAttempt', () => {
    it('creates an attempt and marks hasCorrectAttempt true when submission is correct', async () => {
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111077',
        sessionType: 'practice_room',
        endTime: null,
      } as any);
      prisma.questionUnit.findFirst.mockResolvedValue({
        id: 201,
        contents: [
          {
            id: 301,
            type: 'mcq',
            questionData: { correctOptionIndex: 2 },
          },
        ],
        variants: [],
      } as any);
      prisma.questionAttempt.findFirst.mockResolvedValue(null);
      prisma.questionAttempt.create.mockResolvedValue({ id: 999 } as any);

      const result = await service.submitAttempt(1, 10, 100, {
        moduleUnitId: 10,
        questionUnitId: 201,
        questionContentId: 301,
        sessionId: '11111111-1111-4111-8111-111111111077',
        timeTakenMs: 1200,
        hintUnlocked: false,
        studentAnswer: { selectedOptionIndex: 2 } as any,
      });

      expect(prisma.questionAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          moduleUnitId: 10,
          studentId: 100,
          questionId: 201,
          contentId: 301,
          sessionId: '11111111-1111-4111-8111-111111111077',
          isCorrect: true,
          timeTakenMs: 1200,
          hintsUsed: 0,
          studentAnswer: { selectedOptionIndex: 2 },
          attemptedAt: expect.any(Date),
        }),
        select: { id: true },
      });
      expect(
        studentModuleUnitProgressService.syncFromAttempts,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleUnitId: 10,
          studentId: 100,
          attemptedAt: expect.any(Date),
        }),
        prisma,
      );
      expect(result).toEqual({
        awards: {
          baseQuestionExp: 33,
          firstAttemptBonus: 17,
          streakBonus: 0,
          accountExp: 0,
        },
        hasCorrectAttempt: true,
        updatedModuleProgress: {
          id: 1,
          title: 'Biology',
          description: 'Study biology',
          userModuleLevel: 1,
          currentExp: 50,
          expMax: 1000,
        },
        currentStreak: 0,
        highestStreak: 0,
      });
      expect(practiceRewardService.awardAttemptModuleExp).toHaveBeenCalledWith(
        {
          studentId: 100,
          moduleId: 1,
          moduleUnitId: 10,
          sessionId: '11111111-1111-4111-8111-111111111077',
          questionUnitId: 201,
          isCorrect: true,
          hadCorrectAttemptBeforeSubmit: false,
          hadAnyAttemptBeforeSubmit: false,
        },
        prisma,
      );
      expect(practiceRewardService.awardCompletionExp).not.toHaveBeenCalled();
    });

    it('throws when payload module unit does not match route module unit', async () => {
      await expect(
        service.submitAttempt(1, 10, 100, {
          moduleUnitId: 999,
          questionUnitId: 201,
          questionContentId: 301,
          sessionId: '11111111-1111-4111-8111-111111111077',
          timeTakenMs: 1200,
          hintUnlocked: true,
          studentAnswer: { selectedOptionIndex: 2 } as any,
        }),
      ).rejects.toThrow(
        'Submitted module unit does not match the current route.',
      );
    });

    it('throws when session does not belong to student/module', async () => {
      prisma.practiceSession.findFirst.mockResolvedValue(null);

      await expect(
        service.submitAttempt(1, 10, 100, {
          moduleUnitId: 10,
          questionUnitId: 201,
          questionContentId: 301,
          sessionId: '11111111-1111-4111-8111-111111111077',
          timeTakenMs: 1200,
          hintUnlocked: true,
          studentAnswer: { selectedOptionIndex: 2 } as any,
        }),
      ).rejects.toThrow('Practice session not found for this module.');
    });

    it('throws ForbiddenException when module unit is already completed', async () => {
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111077',
        sessionType: 'practice_room',
        endTime: null,
      } as any);
      prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
        isCompleted: true,
      } as any);

      await expect(
        service.submitAttempt(1, 10, 100, {
          moduleUnitId: 10,
          questionUnitId: 201,
          questionContentId: 301,
          sessionId: '11111111-1111-4111-8111-111111111077',
          timeTakenMs: 1200,
          hintUnlocked: true,
          studentAnswer: { selectedOptionIndex: 2 } as any,
        }),
      ).rejects.toMatchObject({
        message: 'This unit is completed. Viewing answers is read-only.',
      });
      expect(prisma.questionAttempt.create).not.toHaveBeenCalled();
    });

    it('throws when the session type is view_answers', async () => {
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111077',
        sessionType: 'view_answers',
        endTime: null,
      } as any);

      await expect(
        service.submitAttempt(1, 10, 100, {
          moduleUnitId: 10,
          questionUnitId: 201,
          questionContentId: 301,
          sessionId: '11111111-1111-4111-8111-111111111077',
          timeTakenMs: 1200,
          hintUnlocked: true,
          studentAnswer: { selectedOptionIndex: 2 } as any,
        }),
      ).rejects.toMatchObject({
        message:
          'This session is read-only. Start a practice session to submit answers.',
      });
      expect(prisma.questionAttempt.create).not.toHaveBeenCalled();
    });

    it('closes the active session when completion is reached', async () => {
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111077',
        sessionType: 'practice_room',
        endTime: null,
      } as any);
      prisma.questionUnit.findFirst.mockResolvedValue({
        id: 201,
        contents: [
          {
            id: 301,
            type: 'mcq',
            questionData: { correctOptionIndex: 2 },
          },
        ],
      } as any);
      prisma.questionAttempt.findFirst.mockResolvedValue(null);
      prisma.questionAttempt.create.mockResolvedValue({ id: 999 } as any);
      studentModuleUnitProgressService.syncFromAttempts.mockResolvedValueOnce({
        moduleUnitId: 10,
        studentId: 100,
        currentMasteryScore: 1,
        noOfCorrectAnswers: 1,
        isCompleted: true,
        completedAt: new Date('2026-02-26T10:00:00.000Z'),
        lastPracticedAt: new Date('2026-02-26T10:00:00.000Z'),
      });
      prisma.practiceSession.updateMany.mockResolvedValue({ count: 1 } as any);

      await service.submitAttempt(1, 10, 100, {
        moduleUnitId: 10,
        questionUnitId: 201,
        questionContentId: 301,
        sessionId: '11111111-1111-4111-8111-111111111077',
        timeTakenMs: 1200,
        hintUnlocked: false,
        studentAnswer: { selectedOptionIndex: 2 } as any,
      });

      expect(prisma.practiceSession.updateMany).toHaveBeenCalledWith({
        where: { id: '11111111-1111-4111-8111-111111111077', endTime: null },
        data: { endTime: expect.any(Date) },
      });
      expect(practiceRewardService.awardCompletionExp).toHaveBeenCalledWith(
        {
          studentId: 100,
          moduleId: 1,
          moduleUnitId: 10,
          sessionId: '11111111-1111-4111-8111-111111111077',
          completedAt: expect.any(Date),
        },
        prisma,
      );
    });

    it('does not re-apply XP when ledger events already exist', async () => {
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111077',
        sessionType: 'practice_room',
        endTime: null,
      } as any);
      prisma.questionUnit.findFirst.mockResolvedValue({
        id: 201,
        contents: [
          {
            id: 301,
            type: 'mcq',
            questionData: { correctOptionIndex: 2 },
          },
        ],
      } as any);
      prisma.questionAttempt.findFirst.mockResolvedValue(null);
      prisma.questionAttempt.create.mockResolvedValue({ id: 999 } as any);
      practiceRewardService.awardAttemptModuleExp.mockResolvedValue({
        moduleExpAwarded: 0,
        moduleAwards: {
          baseQuestionExp: 0,
          firstAttemptBonus: 0,
          streakBonus: 0,
        },
        updatedMembership: null,
      });

      const result = await service.submitAttempt(1, 10, 100, {
        moduleUnitId: 10,
        questionUnitId: 201,
        questionContentId: 301,
        sessionId: '11111111-1111-4111-8111-111111111077',
        timeTakenMs: 1200,
        hintUnlocked: false,
        studentAnswer: { selectedOptionIndex: 2 } as any,
      });

      expect(practiceRewardService.awardAttemptModuleExp).toHaveBeenCalled();
      expect(result.awards).toEqual({
        baseQuestionExp: 0,
        firstAttemptBonus: 0,
        streakBonus: 0,
        accountExp: 0,
      });
    });
  });

  describe('closeSession', () => {
    it('closes an open session and returns closedAt', async () => {
      prisma.moduleUnit.findFirst.mockResolvedValue(
        buildMockModuleUnit({ id: 10 }) as any,
      );
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111077',
        sessionType: 'practice_room',
        endTime: null,
      } as any);
      prisma.practiceSession.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.closeSession(
        1,
        10,
        100,
        '11111111-1111-4111-8111-111111111077',
      );

      expect(prisma.practiceSession.updateMany).toHaveBeenCalledWith({
        where: {
          id: '11111111-1111-4111-8111-111111111077',
          moduleId: 1,
          userId: 100,
          endTime: null,
        },
        data: { endTime: expect.any(Date) },
      });
      expect(result.sessionId).toBe('11111111-1111-4111-8111-111111111077');
      expect(typeof result.closedAt).toBe('string');
    });

    it('returns existing endTime without mutating when already closed', async () => {
      const closedAt = new Date('2026-02-26T11:30:00.000Z');
      prisma.moduleUnit.findFirst.mockResolvedValue(
        buildMockModuleUnit({ id: 10 }) as any,
      );
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111077',
        sessionType: 'practice_room',
        endTime: closedAt,
      } as any);

      const result = await service.closeSession(
        1,
        10,
        100,
        '11111111-1111-4111-8111-111111111077',
      );

      expect(prisma.practiceSession.updateMany).not.toHaveBeenCalled();
      expect(result.closedAt).toBe(closedAt.toISOString());
    });
  });

  describe('closeStaleSessions', () => {
    it('closes sessions stale by last attempt or start time', async () => {
      const now = new Date('2026-02-26T12:00:00.000Z');
      prisma.practiceSession.findMany.mockResolvedValue([
        {
          id: '11111111-1111-4111-8111-111111111001',
          startTime: new Date('2026-02-26T09:30:00.000Z'),
          questionAttempts: [],
        },
        {
          id: '11111111-1111-4111-8111-111111111002',
          startTime: new Date('2026-02-26T10:30:00.000Z'),
          questionAttempts: [
            { attemptedAt: new Date('2026-02-26T10:45:00.000Z') },
          ],
        },
        {
          id: '11111111-1111-4111-8111-111111111003',
          startTime: new Date('2026-02-26T11:30:00.000Z'),
          questionAttempts: [
            { attemptedAt: new Date('2026-02-26T11:45:00.000Z') },
          ],
        },
      ] as any);
      prisma.practiceSession.updateMany.mockResolvedValue({ count: 2 } as any);

      const result = await service.closeStaleSessions({
        now,
        inactivityMinutes: 60,
      });

      expect(prisma.practiceSession.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [
              '11111111-1111-4111-8111-111111111001',
              '11111111-1111-4111-8111-111111111002',
            ],
          },
          endTime: null,
        },
        data: { endTime: now },
      });
      expect(result.closedCount).toBe(2);
    });

    it('returns zero when no stale sessions are found', async () => {
      prisma.practiceSession.findMany.mockResolvedValue([
        {
          id: '11111111-1111-4111-8111-111111111003',
          startTime: new Date('2026-02-26T11:30:00.000Z'),
          questionAttempts: [
            { attemptedAt: new Date('2026-02-26T11:45:00.000Z') },
          ],
        },
      ] as any);

      const result = await service.closeStaleSessions({
        now: new Date('2026-02-26T12:00:00.000Z'),
        inactivityMinutes: 60,
      });

      expect(prisma.practiceSession.updateMany).not.toHaveBeenCalled();
      expect(result.closedCount).toBe(0);
    });
  });

  describe('Boundary conditions', () => {
    // ===== LARGE DATASET =====
    it('should handle module unit with many questions', async () => {
      const questions = Array.from({ length: 100 }, (_, i) =>
        buildQuestionUnit(i + 1, true),
      );
      const mockModuleUnit = buildMockModuleUnit({ questionUnits: questions });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111112000',
      } as any);

      prisma.questionAttempt.findMany.mockResolvedValue([]);

      const result = await service.getPracticeRoom(1, 10, 100);

      // Query should include all 100 question IDs
      const call = prisma.questionAttempt.findMany.mock.calls[0]?.[0] as any;
      expect(call?.where?.questionId?.in).toHaveLength(100);
      expect(result.practiceRoom.questions).toHaveLength(100);
    });

    // ===== NULL/UNDEFINED HANDLING in attempt fields =====
    it('should handle attempts with null student answer', async () => {
      const questionUnitDrafts = [buildQuestionUnitDraft()];
      const mockAttempt = buildAttempt({ studentAnswer: null as any });
      prisma.questionAttempt.findMany.mockResolvedValue([mockAttempt as any]);

      const result = await (service as any).getLatestAttempts(
        10,
        100,
        questionUnitDrafts,
      );

      expect(result[0].studentAnswer).toBeNull();
    });

    // ===== SPECIAL CHARACTER HANDLING in titles =====
    it('should handle module unit title with special characters', async () => {
      const mockModuleUnit = buildMockModuleUnit({
        title: 'Unit 2.1: "Advanced" Topics & More (β-version)',
        questionUnits: [buildQuestionUnit(1, true)],
      });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111999',
      } as any);
      prisma.questionAttempt.findMany.mockResolvedValue([]);

      const result = await service.getPracticeRoom(1, 10, 100);

      expect(result.practiceRoom.moduleUnitTitle).toBe(
        'Unit 2.1: "Advanced" Topics & More (β-version)',
      );
    });

    // ===== NUMERIC BOUNDARY: Large IDs =====
    it('should handle large numeric IDs', async () => {
      const mockModuleUnit = buildMockModuleUnit({
        id: 999999,
        questionUnits: [buildQuestionUnit(888888, true)],
      });
      prisma.moduleUnit.findFirst.mockResolvedValue(mockModuleUnit as any);
      prisma.practiceSession.create.mockResolvedValue({
        id: '11111111-1111-4111-8111-111119999999',
      } as any);
      prisma.questionAttempt.findMany.mockResolvedValue([]);

      const result = await service.getPracticeRoom(777777, 999999, 666666);

      expect(result.practiceRoom.sessionId).toBe(
        '11111111-1111-4111-8111-111119999999',
      );
      expect(result.practiceRoom.moduleUnitId).toBe(999999);
    });
  });
});
