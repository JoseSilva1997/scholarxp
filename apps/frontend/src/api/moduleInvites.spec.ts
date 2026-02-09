// Verifies module-invite API helpers call apiFetch with expected route and payload contracts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModuleInvite,
  deleteModuleInvite,
  listModuleInvites,
  redeemInvite,
  updateModuleInvite,
} from './moduleInvites';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('./client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('moduleInvites api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('creates invite with POST /modules/:moduleId/invites', async () => {
    const payload = {
      maxUses: 5,
      expiresInHours: 24,
    };

    await createModuleInvite(10, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/modules/10/invites', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('lists invites with GET /modules/:moduleId/invites', async () => {
    await listModuleInvites(10);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/modules/10/invites', {
      method: 'GET',
    });
  });

  it('updates invite with PATCH /modules/:moduleId/invites/:inviteId', async () => {
    const payload = {
      maxUses: 12,
      revoke: true,
    };

    await updateModuleInvite(10, 8, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/modules/10/invites/8', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  });

  it('deletes invite with DELETE /modules/:moduleId/invites/:inviteId', async () => {
    await deleteModuleInvite(10, 8);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/modules/10/invites/8', {
      method: 'DELETE',
    });
  });

  it('redeems invite with POST /invites/redeem', async () => {
    await redeemInvite('invite-token');

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/invites/redeem', {
      method: 'POST',
      body: JSON.stringify({ token: 'invite-token' }),
    });
  });
});
