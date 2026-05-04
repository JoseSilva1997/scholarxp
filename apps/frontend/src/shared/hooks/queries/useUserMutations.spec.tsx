// Verifies user mutation hooks delegate payloads to user API helpers for role updates.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateUserRoleMutation } from '@/shared/hooks/queries/useUserMutations';

const apiMocks = vi.hoisted(() => ({
  updateUserRole: vi.fn(),
}));

vi.mock('@/Account/api/users', () => ({
  updateUserRole: apiMocks.updateUserRole,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUserMutations', () => {
  beforeEach(() => {
    apiMocks.updateUserRole.mockReset();
  });

  it('useUpdateUserRoleMutation forwards id and role to updateUserRole api', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    apiMocks.updateUserRole.mockResolvedValue({ id: 10, globalRole: 'admin' });

    const { result } = renderHook(() => useUpdateUserRoleMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ userId: 10, globalRole: 'admin' });
    });

    expect(apiMocks.updateUserRole).toHaveBeenCalledWith(10, 'admin');
  });
});
