// Verifies quest API helpers preserve history query construction and progress trigger routes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMasterQuestStreak,
  listQuests,
  recordCompletedUnitReviewQuestProgress,
  recordDailyRevisionQuestProgress,
} from '@/Quests/api/quests';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('quests api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('lists quest history without a query string when no filters are provided', async () => {
    await listQuests({});

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/daily-quest/history', {
      method: 'GET',
    });
  });

  it('lists quest history with day limit and offset query parameters', async () => {
    await listQuests({ dayLimit: 14, dayOffset: 7 });

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/daily-quest/history?dayLimit=14&dayOffset=7',
      { method: 'GET' },
    );
  });

  it('fetches the master quest streak', async () => {
    await getMasterQuestStreak();

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/daily-quest/master-streak', {
      method: 'GET',
    });
  });

  it('records daily revision quest progress for a module', async () => {
    await recordDailyRevisionQuestProgress(44);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/daily-quest/module/44/daily-revision-click',
      { method: 'POST' },
    );
  });

  it('records completed unit review quest progress for a module unit', async () => {
    await recordCompletedUnitReviewQuestProgress(44, 99);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/daily-quest/module/44/unit/99/completed-review',
      { method: 'POST' },
    );
  });
});
