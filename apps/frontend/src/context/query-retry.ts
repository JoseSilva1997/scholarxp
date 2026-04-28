// Query retry policy shared by the app provider and tests without mixing non-components into provider modules.
import { ApiError } from '@/shared/api/client';

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) {
    return false;
  }
  return failureCount < 2;
}
