// Re-exports shared e2e bootstrap and cleanup helpers so quest suites can reuse the test app/auth setup without duplicating it.
// Quest-specific tests leverage the same database transactions, auth injection, and destructive cleanup as daily-practice suites.
// This follows the DRY principle: app configuration is defined once in daily-practice/helpers.ts and shared across domain suites.
export {
  assertSafeE2eDatabaseUrl as assertSafeQuestE2eDatabaseUrl,
  clearDailyPracticeE2eDatabase as clearQuestE2eDatabase,
  createDailyPracticeE2eApp as createQuestE2eApp,
  setAuthenticatedUserId,
} from '../daily-practice/helpers';
