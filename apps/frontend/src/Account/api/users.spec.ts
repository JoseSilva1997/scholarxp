// Verifies user API helpers keep route and payload contracts stable for role updates.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateUserRole } from '@/Account/api/users';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('users api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('updates user role with PATCH /users/:id/role and globalRole payload', async () => {
    await updateUserRole(55, 'admin');

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/users/55/role', {
      method: 'PATCH',
      body: JSON.stringify({ globalRole: 'admin' }),
    });
  });
});
