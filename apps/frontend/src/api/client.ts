// Centralized fetch wrapper for the frontend: standardizes base URL, credentials, CSRF handling,
// and error shaping so feature-specific API modules can stay focused on their endpoints.
import { logError, logMessage } from '../utils/logger';

const API_BASE = import.meta.env.VITE_API_URL;

if (!API_BASE) {
  throw new Error('VITE_API_URL is not set. Define it to point at the backend API.');
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  rawMessage?: string;
  path?: string;
  requestId?: string | null;

  constructor({
    message,
    status,
    data,
    rawMessage,
    path,
    requestId,
  }: {
    message: string;
    status: number;
    data: unknown;
    rawMessage?: string;
    path?: string;
    requestId?: string | null;
  }) {
    super(message);
    this.status = status;
    this.data = data;
    this.rawMessage = rawMessage;
    this.path = path;
    this.requestId = requestId;
  }
}

type ApiOptions = RequestInit & {
  /** Override base URL for a specific call */
  baseUrl?: string;
};

// CSRF token maintained from backend responses; refreshed each request via response header.
let csrfToken: string | null = null;

export function clearCsrfToken() {
  csrfToken = null;
}

// Explicit setter allows callers (e.g., logout response) to prime the token without an extra round-trip.
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

// Force-refresh the CSRF token by clearing cache and fetching from the server.
export async function refreshCsrfToken(baseUrl?: string) {
  csrfToken = null;
  await fetchCsrfToken(baseUrl ?? API_BASE);
}

/**
 * Ensures a CSRF token is loaded after explicit invalidation (e.g., logout) so the next
 * state-changing request does not trip the server's CSRF guard.
 */
export async function ensureCsrfToken(baseUrl?: string) {
  if (!csrfToken) {
    await fetchCsrfToken(baseUrl ?? API_BASE);
  }
}

async function fetchCsrfToken(baseUrl: string) {
  const resp = await fetch(`${baseUrl}/auth/csrf`, {
    credentials: 'include',
  });
  const headerToken = resp.headers.get('x-csrf-token');
  if (headerToken) {
    csrfToken = headerToken;
    logMessage('CSRF token refreshed from header', { token: csrfToken?.slice(0, 8) }, 'debug');
    return;
  }
  // Fallback to body shape { csrfToken }
  const contentType = resp.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      const body = (await resp.json()) as { csrfToken?: string };
      if (body.csrfToken) {
        csrfToken = body.csrfToken;
        logMessage('CSRF token refreshed from body', { token: csrfToken?.slice(0, 8) }, 'debug');
      }
    } catch {
      // ignore body parsing; rely on header
    }
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { baseUrl = API_BASE, headers, method = 'GET', ...rest } = options;

  // Ensure we have a CSRF token before mutating requests; backend issues a token on any response.
  const methodUpper = method.toUpperCase();
  const isSafe = methodUpper === 'GET' || methodUpper === 'HEAD' || methodUpper === 'OPTIONS';
  if (!csrfToken && !isSafe) {
    await fetchCsrfToken(baseUrl);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...(headers ?? {}),
    },
    method: methodUpper,
    ...rest,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const data: unknown = isJson ? await response.json() : await response.text();
  const requestId = response.headers.get('x-request-id');
  const headerToken = response.headers.get('x-csrf-token');
  if (headerToken) {
    csrfToken = headerToken;
    logMessage('CSRF token updated from response header', { path, token: csrfToken?.slice(0, 8) }, 'debug');
  }

  if (!response.ok) {
    const extracted =
      isJson && typeof data === 'object' && data && 'message' in data
        ? (data as { message: unknown }).message
        : undefined;
    const rawMessage = Array.isArray(extracted)
      ? extracted.join(', ')
      : (extracted as string | undefined);
    // Show specific messages when the backend intentionally sends them; otherwise fall back to a generic copy.
    const safeMessage =
      (typeof rawMessage === 'string' && rawMessage.trim().length > 0
        ? rawMessage
        : null) ?? 'Something went wrong. Please try again.';
    const isServerError = response.status >= 500;
    const isClientValidation =
      response.status >= 400 && response.status < 500;

    // Only escalate unexpected/server issues; keep validation/expected client errors at warning level.
    if (isServerError) {
      logError(new Error('API request failed'), {
        path,
        status: response.status,
        rawMessage,
        requestId,
      });
    } else if (isClientValidation) {
      logMessage('API client validation error', {
        path,
        status: response.status,
        rawMessage,
        requestId,
      }, 'warning');
    }
    throw new ApiError({
      message: safeMessage,
      status: response.status,
      data,
      rawMessage,
      path,
      requestId,
    });
  }

  return data as T;
}
