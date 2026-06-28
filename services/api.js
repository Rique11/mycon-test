/**
 * api.js — cliente HTTP centralizado para integração com backend Spring Boot.
 * Gerencia autenticação, tokens e requisições aos endpoints da API.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8083').replace(/\/+$/, '');

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const AUTH_EVENT = 'auth:tokens-updated';

// ── Token storage ─────────────────────────────────────────────────────────────

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export const AUTH_TOKENS_EVENT = AUTH_EVENT;

// ── Refresh orchestration ─────────────────────────────────────────────────────

let refreshPromise = null;

async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      clearTokens();
      return null;
    }
    const data = await response.json();
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── HTTP core ─────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function buildUrl(path, query) {
  const base = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function parseBody(response) {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text || text.trim() === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function extractMessage(body, fallback) {
  if (body && typeof body === 'object') {
    if (typeof body.message === 'string') return body.message;
    if (typeof body.error === 'string') return body.error;
  }
  return fallback;
}

async function request(path, options = {}) {
  const { authenticated = true, body, query, headers, ...rest } = options;

  const doFetch = async (token) => {
    const finalHeaders = {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    };
    if (authenticated && token) finalHeaders.Authorization = `Bearer ${token}`;

    return fetch(buildUrl(path, query), {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await doFetch(authenticated ? getAccessToken() : null);

  if (response.status === 401 && authenticated) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await doFetch(newToken);
    }
    if (response.status === 401) {
      clearTokens();
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
      throw new ApiError(401, 'Sessão expirada. Faça login novamente.', null);
    }
  }

  const parsed = await parseBody(response);
  if (!response.ok) {
    const message = await extractMessage(parsed, `Erro ${response.status}`);
    throw new ApiError(response.status, message, parsed);
  }
  return parsed;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (body) =>
    request('/api/v1/auth/login', { method: 'POST', body, authenticated: false }),

  logout: () => request('/api/v1/auth/logout', { method: 'POST' }),
};

// ── Banker ────────────────────────────────────────────────────────────────────

export const bankerApi = {
  getMe: () => request('/api/v1/bankers/me'),
};

// ── Clients ───────────────────────────────────────────────────────────────────

export const clientsApi = {
  list: (params) => {
    const query = {
      page: params?.page ?? 0,
      size: params?.size ?? 20,
    };
    if (params?.q?.trim()) {
      query.q = params.q.trim();
    }
    return request('/api/v1/clients', { query });
  },

  getById: (id) => request(`/api/v1/clients/${id}`),

  getInsights: (id) =>
    request(`/api/v1/clients/${id}/insights`),

  getCategoryBreakdown: (id, params) =>
    request(
      `/api/v1/clients/${id}/category-breakdown`,
      { query: params },
    ),

  getIncomeComposition: (id, params) =>
    request(
      `/api/v1/clients/${id}/income-composition`,
      { query: params },
    ),
};
