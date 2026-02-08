// App-level TanStack Query provider so server-state behavior is consistent across screens.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep retries for transient failures, but avoid retry loops for expected auth/permission/not-found errors.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
      // Focus refetch can be noisy for this app's modal-heavy flows; we keep explicit invalidation instead.
      refetchOnWindowFocus: false,
    },
  },
});

type AppQueryProviderProps = {
  children: ReactNode;
};

export function AppQueryProvider({ children }: AppQueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

