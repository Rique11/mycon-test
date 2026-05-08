/**
 * api.ts — cliente HTTP centralizado para integração com backend Spring Boot.
 * Gerencia autenticação, tokens e requisições tipadas aos endpoints da API.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8081').replace(/\/+$/, '');

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const AUTH_EVENT = 'auth:tokens-updated';

// ── Token storage ─────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export const AUTH_TOKENS_EVENT = AUTH_EVENT;

// ── Refresh orchestration ─────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
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
    const data = (await response.json()) as AuthResponse;
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── HTTP core ─────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  authenticated?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text || text.trim() === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function extractMessage(body: unknown, fallback: string): Promise<string> {
  if (body && typeof body === 'object') {
    const asRecord = body as Record<string, unknown>;
    if (typeof asRecord.message === 'string') return asRecord.message;
    if (typeof asRecord.error === 'string') return asRecord.error;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = true, body, query, headers, ...rest } = options;

  const doFetch = async (token: string | null): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
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
  return parsed as T;
}

// ── Spring Page<T> ────────────────────────────────────────────────────────────

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface MessageResponse {
  message: string;
}

export const authApi = {
  login: (body: LoginRequest) =>
    request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body, authenticated: false }),

  logout: () => request<MessageResponse>('/api/v1/auth/logout', { method: 'POST' }),
};

// ── Banker ────────────────────────────────────────────────────────────────────

export interface BankerProfileResponse {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

export const bankerApi = {
  getMe: () => request<BankerProfileResponse>('/api/v1/bankers/me'),
};

// ── Clients ───────────────────────────────────────────────────────────────────

export interface ClientResponse {
  id: string;
  name: string;
  email: string;
  cpf: string;
  akropoliLinkId: string | null;
  active: boolean;
  categoryId: string | null;
}

export interface ClientInsightsResponse {
  clientId: string;
  bankerId: string;
  lastSyncAt: string | null;
  syncStatus: string;
  totalAssets: string | number;
  totalLiabilities: string | number;
  netWorth: string | number | null;
  creditUtilizationRatio: string | number | null;
  weightedCet: string | number | null;
  nextDueAmount30d: string | number | null;
  cardMinimumOnlyCount: number | null;
  overdraftUsedAmount: string | number | null;
  avgMonthlySpend3m: string | number | null;
  avgMonthlySpend12m: string | number | null;
  avgMonthlyIncome3m: string | number | null;
  avgMonthlyIncome12m: string | number | null;
  incomeDetected: boolean;
  savingsCapacity3m: string | number | null;
  debtToIncomeRatio: string | number | null;
  healthScore: number | null;
  history?: Array<{
    snapshotDate: string;
    totalAssets: string | number;
    totalLiabilities: string | number;
    netWorth: string | number | null;
    creditUtilizationRatio: string | number | null;
    avgMonthlySpend3m: string | number | null;
    avgMonthlyIncome3m: string | number | null;
    nextDueAmount30d: string | number | null;
    healthScore: number | null;
  }>;
}

export interface CategoryBreakdownResponse {
  clientId: string;
  fromYearMonth: string;
  toYearMonth: string;
  rows: Array<{
    yearMonth: string;
    category: string;
    totalAmount: string | number;
    transactionCount: number;
    source: 'ACCOUNT' | 'CARD' | 'MIXED';
  }>;
}

export const clientsApi = {
  list: (params?: { page?: number; size?: number; q?: string }) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 0,
      size: params?.size ?? 20,
    };
    if (params?.q?.trim()) {
      query.q = params.q.trim();
    }
    return request<Page<ClientResponse>>('/api/v1/clients', { query });
  },

  getById: (id: string) => request<ClientResponse>(`/api/v1/clients/${id}`),

  getInsights: (id: string) =>
    request<ClientInsightsResponse>(`/api/v1/clients/${id}/insights`),

  getCategoryBreakdown: (id: string, params?: { from?: string; to?: string }) =>
    request<CategoryBreakdownResponse>(
      `/api/v1/clients/${id}/category-breakdown`,
      { query: params },
    ),
};
