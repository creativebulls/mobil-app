import { getApiBaseUrl, resetBackendHost } from '../config/api';
import { ApiError, type ApiSuccessBody } from './types';
import { getAccessToken, getRefreshToken, saveSession, clearSession } from '../storage/authSession';
import type { AuthResponse } from './types';

type HttpResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type RawInit = {
  method: string;
  headers: Record<string, string>;
  body?: BodyInit;
};

/**
 * Multipart uploads must go through React Native's XMLHttpRequest. Expo's
 * WinterCG `fetch` (the global `fetch` in this SDK) cannot serialize RN's
 * `{ uri, name, type }` file parts and throws "Unsupported FormDataPart".
 * XHR uses RN's native networking, which handles file-uri parts correctly.
 */
function sendViaXhr(url: string, init: RawInit): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method, url);

    Object.entries(init.headers).forEach(([key, value]) => {
      // Let XHR set multipart Content-Type (with boundary) automatically.
      if (key.toLowerCase() === 'content-type') {
        return;
      }
      xhr.setRequestHeader(key, value);
    });

    xhr.onload = () => {
      const text = xhr.responseText;
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async () => (text ? JSON.parse(text) : {}),
      });
    };
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(new TypeError('Network request timed out'));

    xhr.send(init.body as XMLHttpRequestBodyInit);
  });
}

function rawFetch(url: string, init: RawInit): Promise<HttpResponse> {
  if (init.body instanceof FormData) {
    return sendViaXhr(url, init);
  }
  return fetch(url, init);
}

/**
 * Wrapper that targets the auto-detected backend host. If the request fails
 * with a network error (e.g. the host/IP changed), it clears the cached host,
 * re-probes, and retries once.
 */
async function backendFetch(path: string, init: RawInit): Promise<HttpResponse> {
  try {
    const base = await getApiBaseUrl();
    return await rawFetch(`${base}${path}`, init);
  } catch {
    resetBackendHost();
    const base = await getApiBaseUrl();
    return rawFetch(`${base}${path}`, init);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  formData?: FormData;
  skipAuthRefresh?: boolean;
};

async function parseResponse<T>(response: HttpResponse): Promise<T> {
  const payload = (await response.json()) as ApiSuccessBody<T> | { success: false; error: { code: string; message: string; details?: unknown } };

  if (!response.ok || !('success' in payload) || !payload.success) {
    const errorPayload = payload as { error?: { code?: string; message?: string; details?: unknown } };
    throw new ApiError(
      response.status,
      errorPayload.error?.code ?? 'REQUEST_FAILED',
      errorPayload.error?.message ?? 'Request failed',
      errorPayload.error?.details,
    );
  }

  return payload.data;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await backendFetch(`/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearSession();
    return null;
  }

  const data = await parseResponse<AuthResponse>(response);
  await saveSession(data.tokens, data.user);
  return data.tokens.accessToken;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let token = options.token;

  if (token === undefined) {
    token = await getAccessToken();
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;

  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await backendFetch(path, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  if (response.status === 401 && token && !options.skipAuthRefresh) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      return apiRequest<T>(path, {
        ...options,
        token: refreshedToken,
        skipAuthRefresh: true,
      });
    }
  }

  return parseResponse<T>(response);
}
