import { config } from 'dotenv';
import { resolve } from 'path';

const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
const resolvedEnvironmentPath = resolve(
  __dirname,
  `../.env.${runtimeEnvironment}`,
);

const isE2ETestRun = process.env.E2E_TEST_RUN === 'true';

// E2E runs execute destructive cleanup, so they must never inherit development DB credentials by fallback.
if (isE2ETestRun) {
  config({ path: resolvedEnvironmentPath });
} else {
  // Non-test runs keep the development fallback to preserve existing local workflows.
  config({ path: resolvedEnvironmentPath });
  config({ path: resolve(__dirname, '../.env.development'), override: false });
}

function isLikelyTestDatabaseUrl(databaseUrl: string): boolean {
  try {
    const parsedUrl = new URL(databaseUrl);
    const databaseName = parsedUrl.pathname.replace(/^\//, '');
    return /(test|e2e)/i.test(databaseName);
  } catch {
    // Some providers use non-URL connection strings; we still guard with a conservative text match.
    return /(test|e2e)/i.test(databaseUrl);
  }
}

if (isE2ETestRun) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'E2E safety check failed: DATABASE_URL is missing for NODE_ENV=test.',
    );
  }

  if (
    process.env.E2E_ALLOW_NON_TEST_DATABASE !== 'true' &&
    !isLikelyTestDatabaseUrl(databaseUrl)
  ) {
    throw new Error(
      'E2E safety check failed: DATABASE_URL does not look like a test database. Set E2E_ALLOW_NON_TEST_DATABASE=true only if you intentionally accept destructive cleanup.',
    );
  }
}

// Unit specs in src/**/*.spec.ts are mock-driven and should never inherit DB-backed transaction setup from .env.test.
if (!isE2ETestRun) {
  process.env.SKIP_PRISMA_TX = 'true';
}
