// Exposes shared render helpers so unit tests get consistent providers with minimal boilerplate.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';

// Creates a fresh query client per test render so cache state does not leak between assertions.
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

// Factory pattern: assembles the provider tree and exposes the query client for cache assertions.
function createProviders({ route = '/' }: ProvidersOptions = {}) {
  const queryClient = createTestQueryClient();

  // Supplies the routing, theme, and React Query context expected by shared frontend components.
  function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        {/* Keep theme-dependent components stable in tests without repeating provider setup. */}
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
  }

  return { Providers, queryClient };
}

type RenderWithProvidersOptions = RenderOptions & ProvidersOptions;

// Renders a component with the shared application providers used across frontend unit tests.
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
