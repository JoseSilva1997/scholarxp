// Shifts a user's dated learning records backward by N days so the next request
// is treated as a new calendar day for quest/daily-practice generation and module
// unit cooldowns. Lazy generation in the app handles quest/daily-set creation on
// the next request.
import { Prisma } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';
import { parseArgs } from 'util';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ADVANCE A USER 1 DAY:
 *   pnpm --filter backend advance:user-day --user 38
 *
 * ADVANCE BY N DAYS:
 *   pnpm --filter backend advance:user-day --user 38 --days 3
 */

const MANUAL_CONFIG = {
  USER_ID: 47 as number | null,
  DAYS: null as number | null,
};

function parseConfig() {
  const { values } = parseArgs({
    options: {
      user: { type: 'string' },
      days: { type: 'string' },
    },
    args: process.argv.slice(2),
  });

  const userId =
    MANUAL_CONFIG.USER_ID ?? (values.user ? parseInt(values.user, 10) : null);
  const days =
    MANUAL_CONFIG.DAYS ?? (values.days ? parseInt(values.days, 10) : 1);

  return { USER_ID: userId, DAYS: days };
}

const CONFIG = parseConfig();

type ShiftSummary = {
  dailyQuests: number;
  dailyPracticeSets: number;
  questionAttempts: number;
  studentQuestionState: number;
  moduleUnitUserProgress: number;
  practiceSessions: number;
};

function loadRuntimeEnvironment(): void {
  const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
  const backendRoot = process.cwd();

  config({ path: resolve(backendRoot, `.env.${runtimeEnvironment}`) });
  config({ path: resolve(backendRoot, '.env.development'), override: false });
}

async function assertConfiguration(prisma: PrismaService): Promise<void> {
  if (
    CONFIG.USER_ID === null ||
    !Number.isInteger(CONFIG.USER_ID) ||
    CONFIG.USER_ID <= 0
  ) {
    throw new Error('Pass --user <positive integer id>.');
  }

  if (!Number.isInteger(CONFIG.DAYS) || CONFIG.DAYS <= 0) {
    throw new Error('--days must be a positive integer.');
  }

  const userExists = await prisma.user.findUnique({
    where: { id: CONFIG.USER_ID },
    select: { id: true },
  });

  if (!userExists) {
    throw new Error(`User ${CONFIG.USER_ID} does not exist.`);
  }
}

function printConfiguration(): void {
  console.log(
    `Shifting learning data ${CONFIG.DAYS} day(s) backward for user ${CONFIG.USER_ID}.`,
  );
}

// Postgres `INTERVAL '<n> days'` arithmetic on timestamp/date columns.
async function runShift(prisma: PrismaService): Promise<ShiftSummary> {
  const userId = CONFIG.USER_ID as number;
  const days = CONFIG.DAYS;
  const interval = Prisma.sql`(${days}::int * INTERVAL '1 day')`;

  return prisma.$transaction(async (tx) => {
    const dailyQuests = await tx.$executeRaw`
      UPDATE daily_quests
      SET quest_date_utc = quest_date_utc - ${interval},
          generated_at   = generated_at - ${interval},
          completed_at   = CASE WHEN completed_at IS NULL THEN NULL ELSE completed_at - ${interval} END
      WHERE user_id = ${userId}
    `;

    const dailyPracticeSets = await tx.$executeRaw`
      UPDATE daily_practice_sets
      SET practice_date_utc = practice_date_utc - ${interval},
          generated_at      = generated_at - ${interval},
          completed_at      = CASE WHEN completed_at IS NULL THEN NULL ELSE completed_at - ${interval} END
      WHERE user_id = ${userId}
    `;

    const questionAttempts = await tx.$executeRaw`
      UPDATE question_attempts qa
      SET attempted_at = qa.attempted_at - ${interval}
      FROM practice_sessions ps
      WHERE qa.session_id = ps.id
        AND (qa.student_id = ${userId} OR ps.user_id = ${userId})
    `;

    const studentQuestionState = await tx.$executeRaw`
      UPDATE student_question_state
      SET fsrs_due_at            = fsrs_due_at - ${interval},
          fsrs_last_reviewed_at  = CASE WHEN fsrs_last_reviewed_at IS NULL THEN NULL ELSE fsrs_last_reviewed_at - ${interval} END,
          last_seen_at           = CASE WHEN last_seen_at IS NULL THEN NULL ELSE last_seen_at - ${interval} END,
          last_correct_at        = CASE WHEN last_correct_at IS NULL THEN NULL ELSE last_correct_at - ${interval} END,
          first_seen_at          = CASE WHEN first_seen_at IS NULL THEN NULL ELSE first_seen_at - ${interval} END
      WHERE user_id = ${userId}
    `;

    const moduleUnitUserProgress = await tx.$executeRaw`
      UPDATE module_unit_user_progress
      SET completed_at      = CASE WHEN completed_at IS NULL THEN NULL ELSE completed_at - ${interval} END,
          last_practiced_at = CASE WHEN last_practiced_at IS NULL THEN NULL ELSE last_practiced_at - ${interval} END
      WHERE student_id = ${userId}
    `;

    const practiceSessions = await tx.$executeRaw`
      UPDATE practice_sessions
      SET start_time = start_time - ${interval},
          end_time   = CASE WHEN end_time IS NULL THEN NULL ELSE end_time - ${interval} END
      WHERE user_id = ${userId}
    `;

    return {
      dailyQuests,
      dailyPracticeSets,
      questionAttempts,
      studentQuestionState,
      moduleUnitUserProgress,
      practiceSessions,
    };
  });
}

function printSummary(summary: ShiftSummary): void {
  console.log('Shifted rows:');
  console.log(`- daily_quests=${summary.dailyQuests}`);
  console.log(`- daily_practice_sets=${summary.dailyPracticeSets}`);
  console.log(`- question_attempts=${summary.questionAttempts}`);
  console.log(`- student_question_state=${summary.studentQuestionState}`);
  console.log(`- module_unit_user_progress=${summary.moduleUnitUserProgress}`);
  console.log(`- practice_sessions=${summary.practiceSessions}`);
}

async function main(): Promise<void> {
  loadRuntimeEnvironment();

  const prisma = new PrismaService();

  try {
    await prisma.$connect();
    await assertConfiguration(prisma);
    printConfiguration();

    const summary = await runShift(prisma);
    printSummary(summary);
  } finally {
    await prisma.onModuleDestroy();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Advance user day failed: ${message}`);
  process.exitCode = 1;
});
