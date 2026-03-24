// Deletes selected learner-owned practice data so manual cleanup stays aligned with app-owned Prisma relations.
import { Prisma } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';

//pnpm --filter backend cleanup:user-learning-data

const USER_ID = 38;

const DELETE_DAILY_PRACTICE_SETS = true;
const DELETE_DAILY_QUESTS = true;
const DELETE_EXP_LEDGER = true;
const DELETE_MODULE_UNIT_USER_PROGRESS = true;
const DELETE_PRACTICE_SESSIONS = true;
const DELETE_QUESTION_ATTEMPTS = true;
const DELETE_STUDENT_QUESTION_STATE = true;

// Set to a non-negative integer to overwrite the avatar's totalExp after deletes run.
// Leave as null to skip — useful when you only want to wipe data without resetting level.
const SET_ACCOUNT_EXP: number | null = 200;

type DeleteSummary = {
  dailyPracticeSets: number;
  dailyQuests: number;
  expLedger: number;
  moduleUnitUserProgress: number;
  practiceSessions: number;
  questionAttempts: number;
  studentQuestionState: number;
  accountExpSet: number | null;
};

function loadRuntimeEnvironment(): void {
  const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
  const backendRoot = process.cwd();

  // Mirror the app's env fallback so the cleanup script does not surprise local workflows.
  config({
    path: resolve(backendRoot, `.env.${runtimeEnvironment}`),
  });
  config({
    path: resolve(backendRoot, '.env.development'),
    override: false,
  });
}

function buildQuestionAttemptWhere(): Prisma.QuestionAttemptWhereInput {
  return {
    OR: [{ studentId: USER_ID }, { session: { userId: USER_ID } }],
  };
}

async function assertConfiguration(prisma: PrismaService): Promise<void> {
  if (!Number.isInteger(USER_ID) || USER_ID <= 0) {
    throw new Error(
      'Set USER_ID to a positive integer before running this script.',
    );
  }

  if (SET_ACCOUNT_EXP !== null && (!Number.isInteger(SET_ACCOUNT_EXP) || SET_ACCOUNT_EXP < 0)) {
    throw new Error('SET_ACCOUNT_EXP must be a non-negative integer or null.');
  }

  const userExists = await prisma.user.findUnique({
    where: { id: USER_ID },
    select: { id: true },
  });

  if (!userExists) {
    throw new Error(`User ${USER_ID} does not exist.`);
  }

  if (!DELETE_PRACTICE_SESSIONS || DELETE_QUESTION_ATTEMPTS) {
    return;
  }

  // Practice sessions cannot be removed while attempts still reference them through a restrictive FK.
  const blockingAttemptCount = await prisma.questionAttempt.count({
    where: { session: { userId: USER_ID } },
  });

  if (blockingAttemptCount > 0) {
    throw new Error(
      `DELETE_PRACTICE_SESSIONS requires DELETE_QUESTION_ATTEMPTS for user ${USER_ID} because ${blockingAttemptCount} attempt(s) still reference those sessions.`,
    );
  }
}

function printConfiguration(): void {
  console.log(`Deleting data for user ${USER_ID} with this configuration:`);
  console.log(`- DELETE_DAILY_PRACTICE_SETS=${DELETE_DAILY_PRACTICE_SETS}`);
  console.log(`- DELETE_DAILY_QUESTS=${DELETE_DAILY_QUESTS}`);
  console.log(`- DELETE_EXP_LEDGER=${DELETE_EXP_LEDGER}`);
  console.log(
    `- DELETE_MODULE_UNIT_USER_PROGRESS=${DELETE_MODULE_UNIT_USER_PROGRESS}`,
  );
  console.log(`- DELETE_PRACTICE_SESSIONS=${DELETE_PRACTICE_SESSIONS}`);
  console.log(`- DELETE_QUESTION_ATTEMPTS=${DELETE_QUESTION_ATTEMPTS}`);
  console.log(
    `- DELETE_STUDENT_QUESTION_STATE=${DELETE_STUDENT_QUESTION_STATE}`,
  );
  console.log(
    `- SET_ACCOUNT_EXP=${SET_ACCOUNT_EXP ?? '(skipped)'}`,
  );
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
      accountExpSet: null,
    };

    if (DELETE_QUESTION_ATTEMPTS) {
      summary.questionAttempts = (
        await tx.questionAttempt.deleteMany({
          where: buildQuestionAttemptWhere(),
        })
      ).count;
    }

    if (DELETE_EXP_LEDGER) {
      summary.expLedger = (
        await tx.expLedger.deleteMany({
          where: { userId: USER_ID },
        })
      ).count;
    }

    if (DELETE_MODULE_UNIT_USER_PROGRESS) {
      summary.moduleUnitUserProgress = (
        await tx.moduleUnitUserProgress.deleteMany({
          where: { studentId: USER_ID },
        })
      ).count;
    }

    if (DELETE_STUDENT_QUESTION_STATE) {
      summary.studentQuestionState = (
        await tx.studentQuestionState.deleteMany({
          where: { userId: USER_ID },
        })
      ).count;
    }

    if (DELETE_DAILY_PRACTICE_SETS) {
      summary.dailyPracticeSets = (
        await tx.dailyPracticeSet.deleteMany({
          where: { userId: USER_ID },
        })
      ).count;
    }

    if (DELETE_DAILY_QUESTS) {
      summary.dailyQuests = (
        await tx.dailyQuest.deleteMany({
          where: { userId: USER_ID },
        })
      ).count;
    }

    if (DELETE_PRACTICE_SESSIONS) {
      summary.practiceSessions = (
        await tx.practiceSession.deleteMany({
          where: { userId: USER_ID },
        })
      ).count;
    }

    if (SET_ACCOUNT_EXP !== null) {
      // Upsert so the script works whether the avatar row already exists or not.
      await tx.avatar.upsert({
        where: { userId: USER_ID },
        update: { totalExp: SET_ACCOUNT_EXP },
        create: { userId: USER_ID, totalExp: SET_ACCOUNT_EXP },
      });
      summary.accountExpSet = SET_ACCOUNT_EXP;
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
