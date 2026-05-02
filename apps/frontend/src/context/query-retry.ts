// Query retry policy shared by the app provider and tests without mixing non-components into provider modules.
import { ApiError } from '@/shared/api/client';

// Implements the app-wide retry strategy for TanStack Query server-state requests.
export function shouldRetryQuery(failureCount: number, error: unknown) {
  // Client and auth-related failures are deterministic, so retrying them would delay the correct error state.
  if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) {
    return false;
  }
  return failureCount < 2;
}
