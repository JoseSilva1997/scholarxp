const API_BASE = import.meta.env.VITE_API_URL;

if (!API_BASE) {
  throw new Error('VITE_API_URL is not set. Define it to point at the backend API.');
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
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
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      (isJson && typeof data === 'object' && data && 'message' in data && (data as any).message) ||
      response.statusText ||
      'Request failed';
    throw new ApiError(String(message), response.status, data);
  }

  return data as T;
}
