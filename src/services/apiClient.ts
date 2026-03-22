export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

const buildUrl = (path: string, query?: RequestOptions['query']) => {
  const url = new URL(path, API_BASE_URL || window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

type ApiErrorHandler = (error: ApiError) => void;
let _onApiError: ApiErrorHandler | null = null;

/** Register a global handler called on every API error (e.g. for toast notifications). */
export const setApiErrorHandler = (handler: ApiErrorHandler | null) => {
  _onApiError = handler;
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { query, body, headers, ...rest } = options;
  const authToken = localStorage.getItem('medgemma-auth-token');
  const requestId = crypto.randomUUID();
  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    // Handle 401: clear stale token and redirect to login
    if (response.status === 401) {
      localStorage.removeItem('medgemma-auth-token');
      const loginPath = '/login';
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }

    const error = new ApiError(response.statusText || 'Request failed', response.status, payload);
    _onApiError?.(error);
    throw error;
  }

  return payload as T;
};

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};
