// Provides a single place to derive user-facing API error copy and logging behavior.
import { ApiError } from '@/shared/api/client';

type DisplayApiErrorOptions = {
  fallbackMessage: string;
};

// Selects user-facing copy for failed API actions while preserving a caller-specific fallback.
export function getDisplayErrorMessage(
  error: unknown,
  options: DisplayApiErrorOptions,
): string {
  if (!(error instanceof ApiError)) {
    return options.fallbackMessage;
  }

  // Keep display copy backend-owned: use normalized ApiError text unless we need a generic fallback.
  return error.message || options.fallbackMessage;
}

// Determines whether an error should be escalated to logging based on whether the user can resolve it.
export function shouldLogApiError(error: unknown): boolean {
  // Expected 4xx errors are user-fixable and should not pollute telemetry.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return true;
}
