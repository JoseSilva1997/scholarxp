// Deletes selected learner-owned practice data so manual cleanup stays aligned
// with app-owned Prisma relations.
import { Prisma } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';
import { parseArgs } from 'util';
import { PrismaService } from '../prisma/prisma.service';

/**
 * DELETE ALL LEARNING DATA FOR A USER:
 *
 * pnpm --filter backend cleanup:user-learning-data --all
 * or simply
 * pnpm --filter backend cleanup:user-learning-data
 */

/**
 * DELETE FOR A USER + MODULE UNIT:
 * pnpm --filter backend cleanup:user-learning-data --user 38 --moduleUnit 5
 */

/**
 * Current test user ids:
 * (38) joc0869@my.londonmet.ac.uk
 * (35) carlitoscaba
 * (36) scholarxp
 */

// Edit these instead of passing CLI args. null = fall back to CLI arg / default.
const MANUAL_CONFIG = {
  USER_ID: 38 as number | null,
  MODULE_UNIT_ID: null as number | null,
  SET_ACCOUNT_EXP: 0 as number | null,
  DELETE_DAILY_PRACTICE_SETS: null as boolean | null,
  DELETE_DAILY_QUESTS: null as boolean | null,
  DELETE_EXP_LEDGER: null as boolean | null,
  DELETE_MODULE_UNIT_USER_PROGRESS: null as boolean | null,
  DELETE_PRACTICE_SESSIONS: null as boolean | null,
  DELETE_QUESTION_ATTEMPTS: null as boolean | null,
  DELETE_STUDENT_QUESTION_STATE: null as boolean | null,
  // Resets currentExp → 0 and userModuleLevel → 1 on matching UserModule rows.
  RESET_USER_MODULE_PROGRESS: null as boolean | null,
};

function parseConfig() {
  const { values } = parseArgs({
    options: {
      user: { type: 'string' },
      all: { type: 'boolean' },
      moduleUnit: { type: 'string' },
      setAccountExp: { type: 'string' },
    },
    args: process.argv.slice(2),
  });

  const moduleUnitId =
    MANUAL_CONFIG.MODULE_UNIT_ID ??
    (values.moduleUnit ? parseInt(values.moduleUnit, 10) : null);

  const isAll = values.all || (!moduleUnitId && !values.all) || false;

  return {
    USER_ID: MANUAL_CONFIG.USER_ID ?? (values.user ? parseInt(values.user, 10) : 38),
    SET_ACCOUNT_EXP:
      MANUAL_CONFIG.SET_ACCOUNT_EXP ??
      (values.setAccountExp ? parseInt(values.setAccountExp, 10) : isAll ? 200 : null),
    MODULE_UNIT_ID: moduleUnitId,
    IS_ALL: isAll,
    DELETE_DAILY_PRACTICE_SETS: MANUAL_CONFIG.DELETE_DAILY_PRACTICE_SETS ?? isAll,
    DELETE_DAILY_QUESTS: MANUAL_CONFIG.DELETE_DAILY_QUESTS ?? isAll,
    DELETE_EXP_LEDGER: MANUAL_CONFIG.DELETE_EXP_LEDGER ?? (isAll || !!moduleUnitId),
    DELETE_MODULE_UNIT_USER_PROGRESS: MANUAL_CONFIG.DELETE_MODULE_UNIT_USER_PROGRESS ?? (isAll || !!moduleUnitId),
    DELETE_PRACTICE_SESSIONS: MANUAL_CONFIG.DELETE_PRACTICE_SESSIONS ?? (isAll || !!moduleUnitId),
    DELETE_QUESTION_ATTEMPTS: MANUAL_CONFIG.DELETE_QUESTION_ATTEMPTS ?? (isAll || !!moduleUnitId),
    DELETE_STUDENT_QUESTION_STATE: MANUAL_CONFIG.DELETE_STUDENT_QUESTION_STATE ?? (isAll || !!moduleUnitId),
    RESET_USER_MODULE_PROGRESS: MANUAL_CONFIG.RESET_USER_MODULE_PROGRESS ?? (isAll || !!moduleUnitId),
  };
}

const CONFIG = parseConfig();

type DeleteSummary = {
  dailyPracticeSets: number;
  dailyQuests: number;
  expLedger: number;
  moduleUnitUserProgress: number;
  practiceSessions: number;
  questionAttempts: number;
  studentQuestionState: number;
  userModuleReset: number;
  accountExpSet: number | null;
};

function loadRuntimeEnvironment(): void {
  const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
  const backendRoot = process.cwd();

  config({
    path: resolve(backendRoot, `.env.${runtimeEnvironment}`),
  });
  config({
    path: resolve(backendRoot, '.env.development'),
    override: false,
  });
}

function buildQuestionAttemptWhere(): Prisma.QuestionAttemptWhereInput {
  const base: Prisma.QuestionAttemptWhereInput = {
    OR: [
      { studentId: CONFIG.USER_ID },
      { session: { userId: CONFIG.USER_ID } },
    ],
  };

  if (CONFIG.MODULE_UNIT_ID !== null) {
    return {
      AND: [base, { moduleUnitId: CONFIG.MODULE_UNIT_ID }],
    };
  }

  return base;
}

async function assertConfiguration(prisma: PrismaService): Promise<void> {
  if (!Number.isInteger(CONFIG.USER_ID) || CONFIG.USER_ID <= 0) {
    throw new Error(
      'Set USER_ID to a positive integer before running this script.',
    );
  }

  if (
    CONFIG.SET_ACCOUNT_EXP !== null &&
    (!Number.isInteger(CONFIG.SET_ACCOUNT_EXP) || CONFIG.SET_ACCOUNT_EXP < 0)
  ) {
    throw new Error('SET_ACCOUNT_EXP must be a non-negative integer or null.');
  }

  const userExists = await prisma.user.findUnique({
    where: { id: CONFIG.USER_ID },
    select: { id: true },
  });

  if (!userExists) {
    throw new Error(`User ${CONFIG.USER_ID} does not exist.`);
  }

  if (!CONFIG.DELETE_PRACTICE_SESSIONS || CONFIG.DELETE_QUESTION_ATTEMPTS) {
    return;
  }

  const blockingAttemptCount = await prisma.questionAttempt.count({
    where: { session: { userId: CONFIG.USER_ID } },
  });

  if (blockingAttemptCount > 0) {
    throw new Error(
      `DELETE_PRACTICE_SESSIONS requires DELETE_QUESTION_ATTEMPTS for user ${CONFIG.USER_ID} because ${blockingAttemptCount} attempt(s) still reference those sessions.`,
    );
  }
}

function printConfiguration(): void {
  console.log(
    `Deleting data for user ${CONFIG.USER_ID} with this configuration:`,
  );
  console.log(`- MODULE_UNIT_ID=${CONFIG.MODULE_UNIT_ID}`);
  console.log(
    `- DELETE_DAILY_PRACTICE_SETS=${CONFIG.DELETE_DAILY_PRACTICE_SETS}`,
  );
  console.log(`- DELETE_DAILY_QUESTS=${CONFIG.DELETE_DAILY_QUESTS}`);
  console.log(`- DELETE_EXP_LEDGER=${CONFIG.DELETE_EXP_LEDGER}`);
  console.log(
    `- DELETE_MODULE_UNIT_USER_PROGRESS=${CONFIG.DELETE_MODULE_UNIT_USER_PROGRESS}`,
  );
  console.log(`- DELETE_PRACTICE_SESSIONS=${CONFIG.DELETE_PRACTICE_SESSIONS}`);
  console.log(`- DELETE_QUESTION_ATTEMPTS=${CONFIG.DELETE_QUESTION_ATTEMPTS}`);
  console.log(
    `- DELETE_STUDENT_QUESTION_STATE=${CONFIG.DELETE_STUDENT_QUESTION_STATE}`,
  );
  console.log(
    `- RESET_USER_MODULE_PROGRESS=${CONFIG.RESET_USER_MODULE_PROGRESS}`,
  );
  console.log(`- SET_ACCOUNT_EXP=${CONFIG.SET_ACCOUNT_EXP ?? '(skipped)'}`);
}

async function runDeletes(prisma: PrismaService): Promise<DeleteSummary> {
  return prisma.$transaction(async (tx) => {
    const summary: DeleteSummary = {
      dailyPracticeSets: 0,
      dailyQuests: 0,
      expLedger: 0,
      moduleUnitUserProgress: 0,
      practiceSessions: 0,
      questionAttempts: 0,
      studentQuestionState: 0,
      userModuleReset: 0,
      accountExpSet: null,
    };

    // Deleting practice sessions for a specific module unit requires getting their IDs first,
    // since session itself doesn't have moduleUnitId but QuestionAttempts do.
    let practiceSessionIdsToDelete: string[] = [];
    if (CONFIG.DELETE_PRACTICE_SESSIONS && CONFIG.MODULE_UNIT_ID !== null) {
      const attempts = await tx.questionAttempt.findMany({
        where: buildQuestionAttemptWhere(),
        select: { sessionId: true },
      });
      practiceSessionIdsToDelete = Array.from(
        new Set(attempts.map((a) => a.sessionId)),
      );
    }

    if (CONFIG.DELETE_QUESTION_ATTEMPTS) {
      summary.questionAttempts = (
        await tx.questionAttempt.deleteMany({
          where: buildQuestionAttemptWhere(),
        })
      ).count;
    }

    if (CONFIG.DELETE_EXP_LEDGER) {
      const where: Prisma.ExpLedgerWhereInput = { userId: CONFIG.USER_ID };
      if (CONFIG.MODULE_UNIT_ID !== null) {
        where.moduleUnitId = CONFIG.MODULE_UNIT_ID;
      }
      summary.expLedger = (await tx.expLedger.deleteMany({ where })).count;
    }

    if (CONFIG.DELETE_MODULE_UNIT_USER_PROGRESS) {
      const where: Prisma.ModuleUnitUserProgressWhereInput = {
        studentId: CONFIG.USER_ID,
      };
      if (CONFIG.MODULE_UNIT_ID !== null) {
        where.moduleUnitId = CONFIG.MODULE_UNIT_ID;
      }
      summary.moduleUnitUserProgress = (
        await tx.moduleUnitUserProgress.deleteMany({ where })
      ).count;
    }

    if (CONFIG.DELETE_STUDENT_QUESTION_STATE) {
      const where: Prisma.StudentQuestionStateWhereInput = {
        userId: CONFIG.USER_ID,
      };
      if (CONFIG.MODULE_UNIT_ID !== null) {
        where.moduleUnitId = CONFIG.MODULE_UNIT_ID;
      }
      summary.studentQuestionState = (
        await tx.studentQuestionState.deleteMany({ where })
      ).count;
    }

    if (CONFIG.DELETE_DAILY_PRACTICE_SETS) {
      summary.dailyPracticeSets = (
        await tx.dailyPracticeSet.deleteMany({
          where: { userId: CONFIG.USER_ID },
        })
      ).count;
    }

    if (CONFIG.DELETE_DAILY_QUESTS) {
      summary.dailyQuests = (
        await tx.dailyQuest.deleteMany({
          where: { userId: CONFIG.USER_ID },
        })
      ).count;
    }

    if (CONFIG.DELETE_PRACTICE_SESSIONS) {
      const where: Prisma.PracticeSessionWhereInput = {
        userId: CONFIG.USER_ID,
      };
      if (CONFIG.MODULE_UNIT_ID !== null) {
        where.id = { in: practiceSessionIdsToDelete };
      }

      if (
        CONFIG.IS_ALL ||
        (CONFIG.MODULE_UNIT_ID !== null &&
          practiceSessionIdsToDelete.length > 0)
      ) {
        summary.practiceSessions = (
          await tx.practiceSession.deleteMany({ where })
        ).count;
      }
    }

    if (CONFIG.RESET_USER_MODULE_PROGRESS) {
      // When scoped to a module unit, resolve its parent moduleId so we can target the right UserModule row.
      let moduleIdFilter: number | undefined;
      if (CONFIG.MODULE_UNIT_ID !== null) {
        const unit = await tx.moduleUnit.findUnique({
          where: { id: CONFIG.MODULE_UNIT_ID },
          select: { moduleId: true },
        });
        moduleIdFilter = unit?.moduleId ?? undefined;
      }

      const where: Prisma.UserModuleWhereInput = { userId: CONFIG.USER_ID };
      if (moduleIdFilter !== undefined) {
        where.moduleId = moduleIdFilter;
      }

      summary.userModuleReset = (
        await tx.userModule.updateMany({
          where,
          data: { currentExp: 0, userModuleLevel: 1 },
        })
      ).count;
    }

    if (CONFIG.SET_ACCOUNT_EXP !== null) {
      await tx.avatar.upsert({
        where: { userId: CONFIG.USER_ID },
        update: { totalExp: CONFIG.SET_ACCOUNT_EXP },
        create: { userId: CONFIG.USER_ID, totalExp: CONFIG.SET_ACCOUNT_EXP },
      });
      summary.accountExpSet = CONFIG.SET_ACCOUNT_EXP;
    }

    return summary;
  });
}

function printSummary(summary: DeleteSummary): void {
  console.log('Deleted rows:');
  console.log(`- daily_practice_sets=${summary.dailyPracticeSets}`);
  console.log(`- daily_quests=${summary.dailyQuests}`);
  console.log(`- exp_ledger=${summary.expLedger}`);
  console.log(`- module_unit_user_progress=${summary.moduleUnitUserProgress}`);
  console.log(`- practice_sessions=${summary.practiceSessions}`);
  console.log(`- question_attempts=${summary.questionAttempts}`);
  console.log(`- student_question_state=${summary.studentQuestionState}`);
  console.log(`- user_modules reset=${summary.userModuleReset}`);
  if (summary.accountExpSet !== null) {
    console.log(`- account_exp set to ${summary.accountExpSet}`);
  }
}

async function main(): Promise<void> {
  loadRuntimeEnvironment();

  const prisma = new PrismaService();

  try {
    await prisma.$connect();
    await assertConfiguration(prisma);
    printConfiguration();

    const summary = await runDeletes(prisma);
    printSummary(summary);
  } finally {
    await prisma.onModuleDestroy();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`User data cleanup failed: ${message}`);
  process.exitCode = 1;
});
