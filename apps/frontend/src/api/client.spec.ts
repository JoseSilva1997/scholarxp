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

  describe('CSRF token handling', () => {
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

    // BRANCH: safe method (GET) should NOT trigger CSRF fetch
    it('does not fetch CSRF token for safe GET requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: { data: 'test' },
          headers: {
            'content-type': 'application/json',
          },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/modules', { baseUrl: 'http://api.test', method: 'GET' });

      // Only one fetch call should be made (the actual request, not CSRF fetch)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.test/modules',
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    // BRANCH: safe method (HEAD) should NOT trigger CSRF fetch
    it('does not fetch CSRF token for safe HEAD requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          headers: {},
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/check', { baseUrl: 'http://api.test', method: 'HEAD' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.test/check',
        expect.objectContaining({ method: 'HEAD' }),
      );
    });

    // BRANCH: safe method (OPTIONS) should NOT trigger CSRF fetch
    it('does not fetch CSRF token for safe OPTIONS requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          headers: {},
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/cors', { baseUrl: 'http://api.test', method: 'OPTIONS' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.test/cors',
        expect.objectContaining({ method: 'OPTIONS' }),
      );
    });

    // BRANCH: unsafe method (PATCH) should trigger CSRF fetch
    it('fetches CSRF token before PATCH requests', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'patch-token' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/resource', {
        baseUrl: 'http://api.test',
        method: 'PATCH',
        body: JSON.stringify({ field: 'value' }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://api.test/auth/csrf', expect.any(Object));
    });

    // BRANCH: unsafe method (DELETE) should trigger CSRF fetch
    it('fetches CSRF token before DELETE requests', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'delete-token' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 204,
            headers: {},
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/resource/1', { baseUrl: 'http://api.test', method: 'DELETE' });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://api.test/resource/1', expect.any(Object));
    });

    // BRANCH: unsafe method (PUT) should trigger CSRF fetch
    it('fetches CSRF token before PUT requests', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'put-token' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/resource/1', {
        baseUrl: 'http://api.test',
        method: 'PUT',
        body: JSON.stringify({ data: 'new' }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // BRANCH: method case normalization (lowercase)
    it('normalizes method to uppercase before safety check', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'token' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/edit', { baseUrl: 'http://api.test', method: 'post' });

      // Should trigger CSRF fetch because 'post' is not safe
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // BRANCH: CSRF token from response header
    it('updates CSRF token from response headers', async () => {
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

    // BRANCH: CSRF token from response body (fallback when header missing)
    it('extracts CSRF token from response body when header is missing', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { csrfToken: 'token-from-body' },
            headers: {
              'content-type': 'application/json',
            },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/modules', {
        baseUrl: 'http://api.test',
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      });

      const secondRequest = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
      expect(secondRequest?.headers).toEqual(
        expect.objectContaining({
          'x-csrf-token': 'token-from-body',
        }),
      );
    });

    // BRANCH: CSRF fetch response without token (neither header nor body)
    it('handles CSRF fetch response with no token gracefully', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: {},
            headers: {
              'content-type': 'application/json',
            },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      const result = await apiFetch<{ ok: boolean }>('/modules', {
        baseUrl: 'http://api.test',
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      });

      // Should still complete even without token
      expect(result).toEqual({ ok: true });
    });

    // BRANCH: CSRF token body parsing error (JSON parse fails)
    it('handles JSON parse error in CSRF token response body gracefully', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'application/json',
          }),
          json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
          text: vi.fn().mockResolvedValue('not json'),
        } as unknown as Response)
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      // Should not throw despite JSON parse error
      const result = await apiFetch<{ ok: boolean }>('/modules', {
        baseUrl: 'http://api.test',
        method: 'POST',
      });

      expect(result).toEqual({ ok: true });
    });

    // BRANCH: clearCsrfToken function
    it('clears CSRF token with clearCsrfToken function', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'token-1' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'token-2' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch, clearCsrfToken } = await import('./client');

      // First POST: fetches CSRF
      await apiFetch('/first', { baseUrl: 'http://api.test', method: 'POST' });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      clearCsrfToken();

      // Second POST: should fetch CSRF again (token was cleared)
      await apiFetch('/second', { baseUrl: 'http://api.test', method: 'POST' });
      expect(fetchMock).toHaveBeenCalledTimes(4); // 2 more calls (csrf + request)
    });

    // BRANCH: setCsrfToken function
    it('sets CSRF token explicitly and uses it in subsequent requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: { ok: true },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch, setCsrfToken } = await import('./client');

      setCsrfToken('preset-token');
      await apiFetch('/modules', { baseUrl: 'http://api.test', method: 'POST' });

      // Should use the preset token without fetching CSRF
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.test/modules',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-csrf-token': 'preset-token',
          }),
        }),
      );
    });

    // BRANCH: refreshCsrfToken function with explicit baseUrl
    it('refreshCsrfToken clears and refetches the token with explicit baseUrl', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'fresh-token' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { refreshCsrfToken, setCsrfToken } = await import('./client');

      setCsrfToken('old-token');
      await refreshCsrfToken('http://api.test');

      // Should have made a fetch call to the CSRF endpoint
      expect(fetchMock).toHaveBeenCalledWith('http://api.test/auth/csrf', expect.any(Object));
    });

    // BRANCH: refreshCsrfToken with default API_BASE (no baseUrl provided)
    it('refreshCsrfToken uses default API_BASE when baseUrl is not provided', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'fresh-token' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { refreshCsrfToken, setCsrfToken } = await import('./client');

      setCsrfToken('old-token');
      await refreshCsrfToken();

      // Should use the default API_BASE from environment
      expect(fetchMock).toHaveBeenCalledWith('http://api.test/auth/csrf', expect.any(Object));
    });

    // BRANCH: ensureCsrfToken when already set
    it('ensureCsrfToken does not fetch if token is already set', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const { ensureCsrfToken, setCsrfToken } = await import('./client');

      setCsrfToken('already-set');
      await ensureCsrfToken('http://api.test');

      // Should not make any fetch calls
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // BRANCH: ensureCsrfToken when NOT set with explicit baseUrl
    it('ensureCsrfToken fetches token if not already set (explicit baseUrl)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          headers: { 'x-csrf-token': 'ensured-token' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { ensureCsrfToken, clearCsrfToken } = await import('./client');

      clearCsrfToken();
      await ensureCsrfToken('http://api.test');

      // Should have made a fetch call
      expect(fetchMock).toHaveBeenCalledWith('http://api.test/auth/csrf', expect.any(Object));
    });

    // BRANCH: ensureCsrfToken when NOT set using default API_BASE
    it('ensureCsrfToken uses default API_BASE when baseUrl is not provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          headers: { 'x-csrf-token': 'ensured-token' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { ensureCsrfToken, clearCsrfToken } = await import('./client');

      clearCsrfToken();
      await ensureCsrfToken();

      // Should have made a fetch call to default API_BASE
      expect(fetchMock).toHaveBeenCalledWith('http://api.test/auth/csrf', expect.any(Object));
    });
  });

  describe('Content-type handling', () => {
    // BRANCH: JSON response
    it('parses JSON response when content-type includes application/json', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: { data: 'json' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      const result = await apiFetch<{ data: string }>('/test', {
        baseUrl: 'http://api.test',
      });

      expect(result).toEqual({ data: 'json' });
    });

    // BRANCH: JSON response with charset parameter
    it('parses JSON response with charset parameter', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: { data: 'utf8-json' },
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      const result = await apiFetch<{ data: string }>('/test', {
        baseUrl: 'http://api.test',
      });

      expect(result).toEqual({ data: 'utf8-json' });
    });

    // BRANCH: Text response
    it('parses text response when content-type is not JSON', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: 'plain text response',
          headers: { 'content-type': 'text/plain' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      const result = await apiFetch<string>('/test', { baseUrl: 'http://api.test' });

      expect(result).toBe('plain text response');
    });

    // BRANCH: Missing content-type (defaults to text)
    it('defaults to text parsing when content-type header is missing', async () => {
      const textContent = 'some text';
      const responseWithoutContentType = {
        ok: true,
        status: 200,
        headers: new Headers({}),
        json: vi.fn(),
        text: vi.fn().mockResolvedValue(textContent),
      } as unknown as Response;
      const fetchMock = vi.fn().mockResolvedValue(responseWithoutContentType);
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      const result = await apiFetch<string>('/test', { baseUrl: 'http://api.test' });

      expect(result).toBe(textContent);
    });

    // BRANCH: HTML content type
    it('handles non-JSON content types as text', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: '<html>page</html>',
          headers: { 'content-type': 'text/html' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      const result = await apiFetch<string>('/test', { baseUrl: 'http://api.test' });

      expect(result).toBe('<html>page</html>');
    });
  });

  describe('Error handling', () => {
    it('throws ApiError and logs telemetry for server-side failures (5xx)', async () => {
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

    // BRANCH: 4xx error without telemetry
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

    // BRANCH: 401 Unauthorized
    it('throws ApiError for 401 Unauthorized', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 401,
          body: { message: 'Not authenticated' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/protected', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
        status: 401,
        code: 'UNAUTHORIZED',
      });
      expect(loggerMocks.logError).not.toHaveBeenCalled();
    });

    // BRANCH: 403 Forbidden
    it('throws ApiError for 403 Forbidden', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 403,
          body: { message: 'Not authorized' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/admin', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    // BRANCH: 404 Not Found
    it('throws ApiError for 404 Not Found', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 404,
          body: { message: 'Not found' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/missing', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });

    // BRANCH: 409 Conflict
    it('throws ApiError for 409 Conflict', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 409,
          body: { message: 'Resource already exists' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/create', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
        status: 409,
        code: 'CONFLICT',
      });
    });

    // BRANCH: 422 Unprocessable Entity
    it('throws ApiError for 422 Unprocessable Entity', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 422,
          body: {
            message: 'Validation error',
            details: [{ field: 'email', message: 'Invalid email' }],
          },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/validate', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
        status: 422,
        code: 'UNPROCESSABLE_ENTITY',
        details: [{ field: 'email', message: 'Invalid email' }],
      });
    });

    // BRANCH: 429 Too Many Requests
    it('throws ApiError for 429 Too Many Requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 429,
          body: { message: 'Rate limit exceeded' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/limited', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
        status: 429,
        code: 'TOO_MANY_REQUESTS',
      });
    });

    // BRANCH: 502 Bad Gateway (server error)
    it('logs telemetry for 502 Bad Gateway', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 502,
          body: { message: 'Bad gateway' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/gateway', { baseUrl: 'http://api.test' })).rejects.toBeDefined();
      expect(loggerMocks.logError).toHaveBeenCalled();
    });

    // BRANCH: 503 Service Unavailable (server error)
    it('logs telemetry for 503 Service Unavailable', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 503,
          body: { message: 'Service unavailable' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/service', { baseUrl: 'http://api.test' })).rejects.toBeDefined();
      expect(loggerMocks.logError).toHaveBeenCalled();
    });

    // BRANCH: Missing x-request-id header (null)
    it('handles missing x-request-id header gracefully', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 400,
          body: { message: 'Bad request' },
          headers: { 'content-type': 'application/json' },
          // Note: no x-request-id header
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/test', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
        requestId: null,
      });
    });

    // BRANCH: Text response error (non-JSON error)
    it('handles text error responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 500,
          body: 'Internal Server Error',
          headers: { 'content-type': 'text/plain' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await expect(apiFetch('/error', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
        status: 500,
      });
      expect(loggerMocks.logError).toHaveBeenCalled();
    });
  });

  describe('Custom headers and options', () => {
    // BRANCH: Custom headers merged with defaults
    it('merges custom headers with default headers', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'token' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/test', {
        baseUrl: 'http://api.test',
        method: 'POST',
        headers: { 'X-Custom-Header': 'custom-value' },
      });

      const requestOptions = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
      expect(requestOptions?.headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
          'x-csrf-token': 'token',
        }),
      );
    });

    // BRANCH: Default method is GET
    it('defaults to GET method when not specified', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: { data: 'test' },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/test', { baseUrl: 'http://api.test' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.test/test',
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    // BRANCH: Custom baseUrl override
    it('uses custom baseUrl when provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: { ok: true },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/test', { baseUrl: 'http://custom.api' });

      expect(fetchMock).toHaveBeenCalledWith('http://custom.api/test', expect.any(Object));
    });

    // BRANCH: Credentials always included
    it('includes credentials in all requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          status: 200,
          body: { ok: true },
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/test', { baseUrl: 'http://api.test' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        }),
      );
    });

    // BRANCH: Other fetch options passed through
    it('passes through additional RequestInit options', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'token' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      const customBody = JSON.stringify({ test: 'data' });
      await apiFetch('/test', {
        baseUrl: 'http://api.test',
        method: 'POST',
        body: customBody,
      });

      // The CSRF fetch will be called first (index 0)
      // Then the actual request - check the second call (index 1)
      const actualRequest = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
      expect(actualRequest?.body).toBe(customBody);
    });
  });

  describe('API error class', () => {
    // BRANCH: ApiError with all fields
    it('ApiError constructor initializes all fields', async () => {
      const { ApiError } = await import('./client');

      const error = new ApiError({
        message: 'Test error',
        status: 400,
        code: 'BAD_REQUEST',
        data: { raw: 'data' },
        details: [{ field: 'name', message: 'Required' }],
        rawMessage: 'Raw message',
        path: '/test',
        requestId: 'req-123',
      });

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.data).toEqual({ raw: 'data' });
      expect(error.details).toEqual([{ field: 'name', message: 'Required' }]);
      expect(error.rawMessage).toBe('Raw message');
      expect(error.path).toBe('/test');
      expect(error.requestId).toBe('req-123');
      expect(error instanceof Error).toBe(true);
    });

    // BRANCH: ApiError with minimal fields
    it('ApiError constructor works with minimal fields', async () => {
      const { ApiError } = await import('./client');

      const error = new ApiError({
        message: 'Error',
        status: 500,
        code: 'ERROR',
        data: null,
      });

      expect(error.message).toBe('Error');
      expect(error.status).toBe(500);
      expect(error.code).toBe('ERROR');
      expect(error.details).toBeUndefined();
      expect(error.rawMessage).toBeUndefined();
      expect(error.path).toBeUndefined();
      expect(error.requestId).toBeUndefined();
    });
  });

  describe('Initialization', () => {
    // BRANCH: Error when VITE_API_URL is not set
    it('throws error when VITE_API_URL environment variable is not set', async () => {
      vi.resetModules();
      vi.stubEnv('VITE_API_URL', '');

      await expect(import('./client')).rejects.toMatchObject({
        message: 'VITE_API_URL is not set. Define it to point at the backend API.',
      });
    });
  });

  describe('Logging', () => {
    // BRANCH: Logging on CSRF token refresh from header
    it('logs CSRF token refresh from response header', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            headers: { 'x-csrf-token': 'token-123' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/modules', {
        baseUrl: 'http://api.test',
        method: 'POST',
      });

      expect(loggerMocks.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('CSRF token'),
        expect.any(Object),
        'debug',
      );
    });

    // BRANCH: Logging on CSRF token refresh from body
    it('logs CSRF token refresh from response body', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { csrfToken: 'token-from-body' },
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { ok: true },
            headers: { 'content-type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch } = await import('./client');

      await apiFetch('/modules', {
        baseUrl: 'http://api.test',
        method: 'POST',
      });

      expect(loggerMocks.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('CSRF token'),
        expect.any(Object),
        'debug',
      );
    });

    // BRANCH: Logging on response header token update
    it('logs CSRF token update from response headers', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            status: 200,
            body: { data: 'test' },
            headers: {
              'content-type': 'application/json',
              'x-csrf-token': 'new-token',
            },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const { apiFetch, setCsrfToken } = await import('./client');

      setCsrfToken('old-token');
      await apiFetch('/test', { baseUrl: 'http://api.test' });

      expect(loggerMocks.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('CSRF token updated from response header'),
        expect.any(Object),
        'debug',
      );
    });
  });
});
