// Normalizes backend error payloads into one UI-safe shape so components can stay simple.

export type ApiErrorDetail = {
  field?: string;
  message: string;
};

type ParseApiErrorInput = {
  status: number;
  data: unknown;
  requestId?: string | null;
};

export type ParsedApiError = {
  code: string;
  message: string;
  rawMessage?: string;
  details?: ApiErrorDetail[];
  requestId?: string | null;
};

const DEFAULT_API_ERROR_MESSAGE = 'Something went wrong. Please try again.';

type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

// Narrows untrusted response payloads before field extraction to avoid unsafe assumptions about backend shape.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Converts HTTP status codes into stable application error codes when the backend omits one.
function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : `HTTP_${status}_ERROR`;
  }
}

// Extracts backend-authored message text while tolerating validation frameworks that return string arrays.
function extractRawMessage(payload: ApiErrorPayload): string | undefined {
  if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
    return payload.message.trim();
  }

  if (Array.isArray(payload.message)) {
    const joined = payload.message
      // Validation libraries can mix non-string entries into arrays, so only readable messages are kept.
      .filter((entry): entry is string => typeof entry === 'string')
      // Whitespace-only validation messages should not become visible UI copy.
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .join(', ');
    return joined.length > 0 ? joined : undefined;
  }

  return undefined;
}

// Normalizes field-level validation details into a compact shape suitable for form-level rendering.
function normalizeDetails(value: unknown): ApiErrorDetail[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const details = value
    // Each detail entry is validated independently because backend validation shapes can vary by endpoint.
    .map((entry): ApiErrorDetail | null => {
      if (typeof entry === 'string') {
        const message = entry.trim();
        return message.length > 0 ? { message } : null;
      }
      if (!isRecord(entry)) {
        return null;
      }
      if (typeof entry.message !== 'string') {
        return null;
      }
      const message = entry.message.trim();
      if (message.length === 0) {
        return null;
      }
      return {
        message,
        ...(typeof entry.field === 'string' && entry.field.trim().length > 0
          ? { field: entry.field.trim() }
          : {}),
      };
    })
    // Null entries represent malformed or empty validation details that the UI cannot render usefully.
    .filter((entry): entry is ApiErrorDetail => entry !== null);

  return details.length > 0 ? details : undefined;
}

// Public parser used by the API client to give every caller the same display copy and diagnostics.
export function parseApiError({
  status,
  data,
  requestId,
}: ParseApiErrorInput): ParsedApiError {
  const payload: ApiErrorPayload = isRecord(data) ? data : {};
  const code =
    typeof payload.code === 'string' && payload.code.trim().length > 0
      ? payload.code.trim()
      : statusToCode(status);
  const rawMessage = extractRawMessage(payload);
  // Keep the backend as the source of truth for user-facing copy.
  // Fall back only when the response omitted a usable message.
  const message =
    rawMessage ??
    DEFAULT_API_ERROR_MESSAGE;

  return {
    code,
    message,
    rawMessage,
    details: normalizeDetails(payload.details),
    requestId,
  };
}
