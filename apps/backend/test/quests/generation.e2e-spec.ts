// Role: validates quest-generation orchestration end-to-end so the daily quest set, master reward, and lesson quest selection align with seeded scenarios.
import { INestApplication } from '@nestjs/common';
import { QuestTypeValues } from '@scholarxp/api-contracts';
import {
  MASTER_QUEST_COMPLETION_REWARD,
  MAX_DAILY_QUEST_COUNT,
  QUEST_COMPLETION_REWARD,
} from '@scholarxp/constants';
import { DateHelpers } from '../../src/helpers/helpers';
import { PrismaService } from '../../src/prisma/prisma.service';
import { QuestGenerationService } from '../../src/quests/quest-generation.service';
import {
  assertSafeE2eDatabaseUrl,
  clearDailyPracticeE2eDatabase,
  createDailyPracticeE2eApp,
  seedStudentModuleScenario,
  setAuthenticatedUserId,
} from '../daily-practice/helpers';
import {
  seedLiveModuleUnitWithMcqQuestions,
  seedStudentNewScenario,
  seedStudentReviewReadyScenario,
} from '../daily-practice/scenarios';

describe('Quest generation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let questGenerationService: QuestGenerationService;

  beforeAll(async () => {
    const appContext = await createDailyPracticeE2eApp();
    app = appContext.app;
    prisma = appContext.prisma;
    questGenerationService = app.get(QuestGenerationService);
  });

  beforeEach(async () => {
    assertSafeE2eDatabaseUrl();
    await clearDailyPracticeE2eDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('skips generation when the student has no completed unit on a previous UTC day', async () => {
    const base = await seedStudentModuleScenario(prisma);
    await seedStudentNewScenario(prisma, base);
    setAuthenticatedUserId(base.studentId);

    await questGenerationService.ensureQuestDayGeneratedForUser(base.studentId);

    const quests = await prisma.dailyQuest.findMany({
      where: { userId: base.studentId },
    });
    expect(quests).toHaveLength(0);
  });

  it('skips generation when the student is not enrolled in any module', async () => {
    const base = await seedStudentModuleScenario(prisma);
    // Drop the student's enrollment so the listEnrolledModuleIds short-circuit fires.
    await prisma.userModule.deleteMany({ where: { userId: base.studentId } });
    setAuthenticatedUserId(base.studentId);

    await questGenerationService.ensureQuestDayGeneratedForUser(base.studentId);

    const quests = await prisma.dailyQuest.findMany({
      where: { userId: base.studentId },
    });
    expect(quests).toHaveLength(0);
  });

  it('generates complete_daily_practice, daily_practice_streak, and master quests when daily practice is available', async () => {
    const base = await seedStudentModuleScenario(prisma);
    await seedStudentReviewReadyScenario(prisma, base);
    setAuthenticatedUserId(base.studentId);

    await questGenerationService.ensureQuestDayGeneratedForUser(base.studentId);

    const quests = await prisma.dailyQuest.findMany({
      where: { userId: base.studentId },
      orderBy: { type: 'asc' },
    });
    const byType = (type: string) =>
      quests.filter((quest) => quest.type === type);

    expect(quests).toHaveLength(3);
    expect(byType(QuestTypeValues.completeDailyPractice)).toEqual([
      expect.objectContaining({
        moduleId: base.moduleId,
        moduleUnitId: null,
        expGranted: QUEST_COMPLETION_REWARD,
        isCompleted: false,
      }),
    ]);
    expect(byType(QuestTypeValues.dailyPracticeStreak)).toEqual([
      expect.objectContaining({
        moduleId: base.moduleId,
        moduleUnitId: null,
        expGranted: QUEST_COMPLETION_REWARD,
        isCompleted: false,
      }),
    ]);

    // Two daily quests generated → master reward folds in the one missing slot.
    const expectedMasterReward =
      MASTER_QUEST_COMPLETION_REWARD +
      (MAX_DAILY_QUEST_COUNT - 2) * QUEST_COMPLETION_REWARD;
    expect(byType(QuestTypeValues.masterDailyQuests)).toEqual([
      expect.objectContaining({
        moduleId: null,
        moduleUnitId: null,
        expGranted: expectedMasterReward,
        isCompleted: false,
      }),
    ]);

    // Quest day must be stamped at the local-midnight UTC instant for today.
    const expectedDateKey = DateHelpers.getLocalDateKey(new Date(), 'UTC');
    for (const quest of quests) {
      expect(quest.questDateUtc.toISOString()).toBe(
        `${expectedDateKey}T00:00:00.000Z`,
      );
    }
  });

  it('does not duplicate quests when generation runs more than once for the same UTC day', async () => {
    const base = await seedStudentModuleScenario(prisma);
    await seedStudentReviewReadyScenario(prisma, base);
    setAuthenticatedUserId(base.studentId);

    await questGenerationService.ensureQuestDayGeneratedForUser(base.studentId);
    await questGenerationService.ensureQuestDayGeneratedForUser(base.studentId);
    await questGenerationService.ensureQuestDayGeneratedForUser(base.studentId);

    const quests = await prisma.dailyQuest.findMany({
      where: { userId: base.studentId },
    });
    expect(quests).toHaveLength(3);

    const types = quests.map((quest) => quest.type).sort();
    expect(types).toEqual(
      [
        QuestTypeValues.completeDailyPractice,
        QuestTypeValues.dailyPracticeStreak,
        QuestTypeValues.masterDailyQuests,
      ].sort(),
    );
  });

  it('adds a complete_new_unit quest when an unstarted live unit is available alongside daily practice', async () => {
    const base = await seedStudentModuleScenario(prisma);
    const scenario = await seedStudentReviewReadyScenario(prisma, base);
    // Second live unit with active questions but no progress row → eligible new-unit target.
    const newUnit = await seedLiveModuleUnitWithMcqQuestions(
      prisma,
      base.moduleId,
      {
        title: 'Lesson 2',
        sortOrder: 2,
        questionCount: 3,
      },
    );
    setAuthenticatedUserId(scenario.studentId);

    await questGenerationService.ensureQuestDayGeneratedForUser(
      scenario.studentId,
    );

    const quests = await prisma.dailyQuest.findMany({
      where: { userId: scenario.studentId },
    });
    expect(quests).toHaveLength(4);

    const newUnitQuests = quests.filter(
      (quest) => quest.type === QuestTypeValues.completeNewUnit,
    );
    expect(newUnitQuests).toEqual([
      expect.objectContaining({
        moduleId: base.moduleId,
        moduleUnitId: null,
        expGranted: QUEST_COMPLETION_REWARD,
        isCompleted: false,
      }),
    ]);

    // moduleUnitRetry must be suppressed because daily practice is the higher-importance reward.
    expect(
      quests.some((quest) => quest.type === QuestTypeValues.moduleUnitRetry),
    ).toBe(false);

    // With three daily quests (one for each slot) the master reward equals just the base reward.
    const masterQuest = quests.find(
      (quest) => quest.type === QuestTypeValues.masterDailyQuests,
    );
    expect(masterQuest?.expGranted).toBe(MASTER_QUEST_COMPLETION_REWARD);

    // Reference seeded fixture so future test edits cannot accidentally orphan it.
    expect(newUnit.moduleUnitId).toBeGreaterThan(0);
  });

  it('reconciles an existing unclaimed master quest reward when an additional daily quest becomes available later in the day', async () => {
    const firstBase = await seedStudentModuleScenario(prisma);
    const scenario = await seedStudentReviewReadyScenario(prisma, firstBase);
    setAuthenticatedUserId(scenario.studentId);

    // First pass: only one module → 2 daily quests + master reward folds in 1 missing slot.
    await questGenerationService.ensureQuestDayGeneratedForUser(
      scenario.studentId,
    );
    const masterAfterFirstPass = await prisma.dailyQuest.findFirstOrThrow({
      where: {
        userId: scenario.studentId,
        type: QuestTypeValues.masterDailyQuests,
      },
    });
    expect(masterAfterFirstPass.expGranted).toBe(
      MASTER_QUEST_COMPLETION_REWARD + QUEST_COMPLETION_REWARD,
    );

    // Enrol the student in a second module that also has daily practice available, then
    // re-run generation — the new complete_daily_practice quest should drop the master fold-in.
    const secondScenarioBase = await seedStudentModuleScenario(prisma);
    await prisma.userModule.create({
      data: {
        userId: scenario.studentId,
        moduleId: secondScenarioBase.moduleId,
        roleInModule: 'student',
        userModuleLevel: 1,
        currentExp: 0,
      },
    });
    await seedStudentReviewReadyScenario(prisma, {
      studentId: scenario.studentId,
      moduleId: secondScenarioBase.moduleId,
    });

    await questGenerationService.ensureQuestDayGeneratedForUser(
      scenario.studentId,
    );

    const masterAfterSecondPass = await prisma.dailyQuest.findFirstOrThrow({
      where: {
        userId: scenario.studentId,
        type: QuestTypeValues.masterDailyQuests,
      },
    });
    expect(masterAfterSecondPass.id).toBe(masterAfterFirstPass.id);
    expect(masterAfterSecondPass.expGranted).toBe(
      MASTER_QUEST_COMPLETION_REWARD,
    );

    // Both modules must each get their own complete_daily_practice quest.
    const dailyPracticeQuests = await prisma.dailyQuest.findMany({
      where: {
        userId: scenario.studentId,
        type: QuestTypeValues.completeDailyPractice,
      },
      orderBy: { moduleId: 'asc' },
    });
    expect(dailyPracticeQuests.map((quest) => quest.moduleId)).toEqual(
      [firstBase.moduleId, secondScenarioBase.moduleId].sort((a, b) => a - b),
    );

    // Streak quest is one-per-day → still tied to the first available module only.
    const streakQuests = await prisma.dailyQuest.findMany({
      where: {
        userId: scenario.studentId,
        type: QuestTypeValues.dailyPracticeStreak,
      },
    });
    expect(streakQuests).toHaveLength(1);
    expect(streakQuests[0].moduleId).toBe(firstBase.moduleId);
  });
});
