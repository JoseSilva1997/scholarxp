// Validates API client behavior at the network boundary so CSRF, error shaping, and telemetry rules stay stable.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));

vi.mock('../utils/logger', () => loggerMocks);

type MockResponseOptions = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

function createMockResponse({ status, body, headers = {} }: MockResponseOptions): Response {
  const responseHeaders = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: responseHeaders,
    json: vi.fn().mockResolvedValue(body),
    text: vi
      .fn()
      .mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body ?? '')),
  } as unknown as Response;
}

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_API_URL', 'http://api.test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('bootstraps CSRF before mutating requests and forwards the token header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createMockResponse({
          status: 200,
          headers: {
            'x-csrf-token': 'csrf-token-1',
          },
        }),
      )
      .mockResolvedValueOnce(
        createMockResponse({
          status: 200,
          body: { ok: true },
          headers: {
            'content-type': 'application/json',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('./client');

    const result = await apiFetch<{ ok: boolean }>('/modules', {
      baseUrl: 'http://api.test',
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://api.test/auth/csrf',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.test/modules',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-csrf-token': 'csrf-token-1',
        }),
      }),
    );
  });

  it('updates CSRF from response headers and reuses the freshest token on subsequent calls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createMockResponse({
          status: 200,
          body: { first: true },
          headers: {
            'content-type': 'application/json',
            'x-csrf-token': 'fresh-token',
          },
        }),
      )
      .mockResolvedValueOnce(
        createMockResponse({
          status: 200,
          body: { second: true },
          headers: {
            'content-type': 'application/json',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch, setCsrfToken } = await import('./client');

    setCsrfToken('stale-token');
    await apiFetch('/one', { baseUrl: 'http://api.test', method: 'GET' });
    await apiFetch('/two', { baseUrl: 'http://api.test', method: 'GET' });

    const secondRequestOptions = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    expect(secondRequestOptions?.headers).toEqual(
      expect.objectContaining({
        'x-csrf-token': 'fresh-token',
      }),
    );
  });

  it('throws ApiError and logs telemetry for server-side failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createMockResponse({
        status: 500,
        body: { message: 'Database unavailable' },
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-500',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('./client');

    await expect(apiFetch('/boom', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
      message: 'Database unavailable',
      status: 500,
      code: 'INTERNAL_ERROR',
      path: '/boom',
      requestId: 'req-500',
    });
    expect(loggerMocks.logError).toHaveBeenCalledTimes(1);
    expect(loggerMocks.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        path: '/boom',
        status: 500,
        code: 'INTERNAL_ERROR',
        rawMessage: 'Database unavailable',
        requestId: 'req-500',
      }),
    );
  });

  it('throws ApiError without telemetry for expected 4xx responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createMockResponse({
        status: 400,
        body: { message: 'Validation failed' },
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-400',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('./client');

    await expect(apiFetch('/bad-request', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
      message: 'Validation failed',
      status: 400,
      code: 'BAD_REQUEST',
      requestId: 'req-400',
    });
    expect(loggerMocks.logError).not.toHaveBeenCalled();
  });
});
