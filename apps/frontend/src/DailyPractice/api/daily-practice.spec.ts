// Verifies daily-practice API helpers call apiFetch with the expected module-scoped endpoint contracts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDailyPracticeSession,
  getTodayDailyPractice,
  submitDailyPracticeAttempt,
} from '@/DailyPractice/api/daily-practice';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('daily-practice api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('loads today daily practice without a session query by default', async () => {
    await getTodayDailyPractice(7);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/module/7/daily-practice/today',
      {
        method: 'GET',
      },
    );
  });

  it('loads today daily practice with a session query when provided', async () => {
    await getTodayDailyPractice(7, {
      sessionId: '11111111-1111-4111-8111-111111111101',
    });

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/module/7/daily-practice/today?sessionId=11111111-1111-4111-8111-111111111101',
      {
        method: 'GET',
      },
    );
  });

  it('submits daily-practice attempt payloads to the module-scoped endpoint', async () => {
    const payload = {
      setId: '11111111-1111-4111-8111-111111111102',
      moduleUnitId: 11,
      questionUnitId: 101,
      questionContentId: 501,
      sessionId: '11111111-1111-4111-8111-111111111103',
      timeTakenMs: 4200,
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 0 },
    } as const;

    await submitDailyPracticeAttempt(7, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/module/7/daily-practice/attempts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  });

  it('closes the daily-practice session with the module-scoped close endpoint', async () => {
    await closeDailyPracticeSession(
      7,
      '11111111-1111-4111-8111-111111111104',
    );

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/module/7/daily-practice/session/11111111-1111-4111-8111-111111111104/close',
      {
        method: 'POST',
      },
    );
  });
});
