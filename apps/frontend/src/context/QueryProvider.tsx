// App-level TanStack Query provider so server-state behavior is consistent across screens.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { shouldRetryQuery } from '@/context/query-retry';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep retries for transient failures, but avoid retry loops for expected auth/permission/not-found errors.
      retry: shouldRetryQuery,
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
