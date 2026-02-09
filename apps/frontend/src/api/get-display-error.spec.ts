// Covers display and telemetry routing so UIs show safe copy and avoid noisy logging.
import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { getDisplayErrorMessage, shouldLogApiError } from './get-display-error';

describe('getDisplayErrorMessage', () => {
  it('returns fallback copy for non-ApiError values', () => {
    const message = getDisplayErrorMessage(new Error('boom'), {
      fallbackMessage: 'Fallback message',
    });

    expect(message).toBe('Fallback message');
  });

  it('prefers normalized ApiError message', () => {
    const apiError = new ApiError({
      message: 'Backend-safe message',
      status: 400,
      code: 'BAD_REQUEST',
      data: {},
    });

    const message = getDisplayErrorMessage(apiError, {
      fallbackMessage: 'Fallback message',
    });

    expect(message).toBe('Backend-safe message');
  });
});

describe('shouldLogApiError', () => {
  it('does not log expected 4xx ApiError responses', () => {
    const apiError = new ApiError({
      message: 'Validation issue',
      status: 422,
      code: 'UNPROCESSABLE_ENTITY',
      data: {},
    });

    expect(shouldLogApiError(apiError)).toBe(false);
  });

  it('logs non-ApiError values and server-side ApiError responses', () => {
    const serverError = new ApiError({
      message: 'Server issue',
      status: 500,
      code: 'INTERNAL_ERROR',
      data: {},
    });

    expect(shouldLogApiError(serverError)).toBe(true);
    expect(shouldLogApiError(new Error('unexpected'))).toBe(true);
  });
});
