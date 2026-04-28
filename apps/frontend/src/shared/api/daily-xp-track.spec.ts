// Verifies the daily lesson XP track API helper uses the header widget endpoint.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDailyLessonXpTrack } from '@/shared/api/daily-xp-track';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('daily xp track api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('fetches the daily lesson XP track', async () => {
    await getDailyLessonXpTrack();

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/rewards/daily-lesson-xp-track', {
      method: 'GET',
    });
  });
});
