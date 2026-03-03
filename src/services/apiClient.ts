export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const buildUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const withDefaultHeaders = (init?: RequestInit): RequestInit => {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const hasContentType = new Headers(init?.headers || {}).has('Content-Type');

  if (isFormData || hasContentType || !init?.body) {
    return init || {};
  }

  return {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  };
};

export const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), withDefaultHeaders(init));
  } catch {
    throw new ApiError(0, 'Unable to reach the API. Check your connection and try again.');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // Keep fallback message
      }
    } else {
      const text = await response.text();
      if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
        message = 'API returned HTML instead of JSON. Make sure the app is running behind Netlify Functions (`npm run dev:netlify`) or use the production URL.';
      }
    }
    throw new ApiError(response.status, message);
  }

  return response;
};

export const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await apiFetch(path, init);

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const bodyPreview = (await response.text()).slice(0, 120);
    throw new ApiError(
      response.status,
      `Expected JSON response but received '${contentType || 'unknown'}'. Preview: ${bodyPreview}`,
    );
  }

  return (await response.json()) as T;
};
