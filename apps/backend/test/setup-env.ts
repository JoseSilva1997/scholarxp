// Initializes environment variables and enforces database safety for test runs.
// Validates that destructive e2e tests never run against production databases, and distinguishes
// between unit tests (mock-driven, no DB) and e2e tests (live DB with transaction rollback).

import { config } from 'dotenv';
import { resolve } from 'path';

const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
const resolvedEnvironmentPath = resolve(
  __dirname,
  `../.env.${runtimeEnvironment}`,
);

const isE2ETestRun = process.env.E2E_TEST_RUN === 'true';

// E2E runs execute destructive cleanup (full database wipe), so they must never inherit development DB
// credentials by fallback. Unit tests don't need .env.development since they use mocks and skip DB setup.
if (isE2ETestRun) {
  config({ path: resolvedEnvironmentPath });
} else {
  // Non-test runs keep the development fallback to preserve existing local workflows.
  config({ path: resolvedEnvironmentPath });
  config({ path: resolve(__dirname, '../.env.development'), override: false });
}

// Heuristic check to detect whether a database URL/connection string points to a test database.
// Parses standard URL format and falls back to literal string matching for non-URL providers (e.g. some managed services).
function isLikelyTestDatabaseUrl(databaseUrl: string): boolean {
  try {
    const parsedUrl = new URL(databaseUrl);
    const databaseName = parsedUrl.pathname.replace(/^\//, '');
    return /(test|e2e)/i.test(databaseName);
  } catch {
    // Non-URL connection strings (some cloud providers): fall back to conservative text match.
    return /(test|e2e)/i.test(databaseUrl);
  }
}

// Enforce database safety for e2e test runs: fail loudly if DATABASE_URL appears to be production.
// The opt-out E2E_ALLOW_NON_TEST_DATABASE flag requires explicit intent to run destructive cleanup outside test databases.
if (isE2ETestRun) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'E2E safety check failed: DATABASE_URL is missing for NODE_ENV=test.',
    );
  }

  // Abort if the database name does not contain 'test' or 'e2e' and the safety override is not explicitly enabled.
  if (
    process.env.E2E_ALLOW_NON_TEST_DATABASE !== 'true' &&
    !isLikelyTestDatabaseUrl(databaseUrl)
  ) {
    throw new Error(
      'E2E safety check failed: DATABASE_URL does not look like a test database. Set E2E_ALLOW_NON_TEST_DATABASE=true only if you intentionally accept destructive cleanup.',
    );
  }
}

// Unit specs in src/**/*.spec.ts are mock-driven; signal to setup-transactions.ts to skip DB setup entirely.
// This keeps unit tests fast and deterministic without requiring a real database connection.
if (!isE2ETestRun) {
  process.env.SKIP_PRISMA_TX = 'true';
}
