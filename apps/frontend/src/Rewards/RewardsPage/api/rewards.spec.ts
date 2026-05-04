// Verifies cosmetic reward API writes the equipped payload to the rewards endpoint.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { putEquippedCosmetic } from '@/Rewards/RewardsPage/api/rewards';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('rewards api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('equips a cosmetic with PUT /rewards/equipped', async () => {
    const payload = { slot: 'theme', rewardId: 'aurora' } as const;

    await putEquippedCosmetic(payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/rewards/equipped', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  });
});
