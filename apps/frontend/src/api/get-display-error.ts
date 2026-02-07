// Provides a single place to derive user-facing API error copy and logging behavior.
import { ApiError } from './client';

type DisplayApiErrorOptions = {
  fallbackMessage: string;
};

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

export function shouldLogApiError(error: unknown): boolean {
  // Expected 4xx errors are user-fixable and should not pollute telemetry.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return true;
}
