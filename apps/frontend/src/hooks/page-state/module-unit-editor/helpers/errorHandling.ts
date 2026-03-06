// Centralizes expected-vs-unexpected API error handling so editor flows share one message policy.
import { ApiError } from '../../../../api/client';
import { logError } from '../../../../utils/logger';

export const getClientSafeErrorMessage = (
  err: unknown,
  fallbackMessage: string,
): string => {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
    return err.message;
  }
  return fallbackMessage;
};

export const getQuestionSaveErrorMessage = (
  err: unknown,
  fallbackMessage: string,
): string => {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
    return err.details?.[0]?.message ?? err.message ?? fallbackMessage;
  }
  return fallbackMessage;
};

export const isClientError = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.status >= 400 && err.status < 500;

export const logModuleUnitEditorError = (
  err: unknown,
  feature: string,
  action: string,
  unitId: number | null,
) => {
  // Keep telemetry shape consistent so downstream monitoring can group editor failures.
  logError(err, { feature, action, unitId });
};
