// Centralized fetch wrapper for the frontend: standardizes base URL, credentials, and error handling
// so feature-specific API modules can stay focused on their endpoints.
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

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { baseUrl = API_BASE, headers, ...rest } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    ...rest,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const data: unknown = isJson ? await response.json() : await response.text();
  const requestId = response.headers.get('x-request-id');

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
