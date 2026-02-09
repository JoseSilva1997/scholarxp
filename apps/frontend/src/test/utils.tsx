// Exposes shared render helpers so unit tests get consistent providers with minimal boilerplate.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries to keep failure assertions immediate and deterministic.
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

type ProvidersOptions = {
  route?: string;
};

function createProviders({ route = '/' }: ProvidersOptions = {}) {
  const queryClient = createTestQueryClient();

  function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  }

  return { Providers, queryClient };
}

type RenderWithProvidersOptions = RenderOptions & ProvidersOptions;

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const { route, ...renderOptions } = options;
  const { Providers, queryClient } = createProviders({ route });
  const rendered = render(ui, {
    wrapper: Providers,
    ...renderOptions,
  });

  return {
    ...rendered,
    queryClient,
  };
}

export { createTestQueryClient, createProviders };
