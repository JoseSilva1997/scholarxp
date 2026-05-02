// Centralizes expected-vs-unexpected API error handling so editor flows share one message policy.
import { ApiError } from '@/shared/api/client';
import { logError } from '@/utils/logger';

// Returns backend validation/auth messages for client errors while hiding unexpected server failures.
export const getClientSafeErrorMessage = (
  err: unknown,
  fallbackMessage: string,
): string => {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
    return err.message;
  }
  return fallbackMessage;
};

// Extracts the most specific question-save validation message available from API error details.
export const getQuestionSaveErrorMessage = (
  err: unknown,
  fallbackMessage: string,
): string => {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
    return err.details?.[0]?.message ?? err.message ?? fallbackMessage;
  }
  return fallbackMessage;
};

// Identifies expected 4xx API errors that can be shown to authors without extra logging context.
export const isClientError = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.status >= 400 && err.status < 500;

// Logs editor failures with consistent feature/action/unit metadata.
export const logModuleUnitEditorError = (
  err: unknown,
  feature: string,
  action: string,
  unitId: number | null,
) => {
  // Keep telemetry shape consistent so downstream monitoring can group editor failures.
  logError(err, { feature, action, unitId });
};
