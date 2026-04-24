// Verifies API error normalization stays stable so page-state hooks can trust one error contract.
import { describe, expect, it } from 'vitest';
import { parseApiError } from '@/shared/api/parse-api-error';

describe('parseApiError', () => {
  it('falls back to status-derived code and generic message when payload is unusable', () => {
    const result = parseApiError({
      status: 500,
      data: null,
      requestId: 'req-1',
    });

    expect(result).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      rawMessage: undefined,
      details: undefined,
      requestId: 'req-1',
    });
  });

  it('uses backend-provided code/message and trims detail entries', () => {
    const result = parseApiError({
      status: 422,
      data: {
        code: '  EMAIL_TAKEN  ',
        message: '  Email already exists.  ',
        details: [
          { field: ' email ', message: ' must be unique ' },
          '  A plain detail message  ',
          { field: 'ignored', message: '   ' },
          123,
        ],
      },
    });

    expect(result).toEqual({
      code: 'EMAIL_TAKEN',
      message: 'Email already exists.',
      rawMessage: 'Email already exists.',
      details: [
        { field: 'email', message: 'must be unique' },
        { message: 'A plain detail message' },
      ],
      requestId: undefined,
    });
  });

  it('joins message arrays and maps unknown status codes consistently', () => {
    const result = parseApiError({
      status: 418,
      data: {
        message: ['  first ', ' ', 'second'],
      },
    });

    expect(result.code).toBe('HTTP_418_ERROR');
    expect(result.message).toBe('first, second');
    expect(result.rawMessage).toBe('first, second');
  });
});
