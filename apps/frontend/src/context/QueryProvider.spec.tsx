// Verifies app query provider exposes TanStack Query and keeps retry policy status-aware.
import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/client';
import { AppQueryProvider } from '@/context/QueryProvider';
import { shouldRetryQuery } from '@/context/query-retry';

function QueryProbe() {
  const queryClient = useQueryClient();
  return <div>{queryClient ? 'query-ready' : 'query-missing'}</div>;
}

describe('QueryProvider', () => {
  it('provides a query client to children', () => {
    render(
      <AppQueryProvider>
        <QueryProbe />
      </AppQueryProvider>,
    );

    expect(screen.getByText('query-ready')).toBeInTheDocument();
  });

  it('does not retry expected client/auth/not-found API errors', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(
        shouldRetryQuery(
          0,
          new ApiError({
            message: 'Nope',
            status,
            code: 'EXPECTED',
            data: {},
          }),
        ),
      ).toBe(false);
    }
  });

  it('retries transient unknown errors fewer than two times', () => {
    expect(shouldRetryQuery(0, new Error('offline'))).toBe(true);
    expect(shouldRetryQuery(1, new Error('offline'))).toBe(true);
    expect(shouldRetryQuery(2, new Error('offline'))).toBe(false);
  });
});
