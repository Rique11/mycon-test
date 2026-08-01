/**
 * api.ts — cliente HTTP centralizado para integração com backend Spring Boot.
 * Gerencia autenticação, tokens, requisições aos endpoints da API e expõe os
 * tipos das respostas consumidas pelos hooks e telas.
 */

import {
  firebaseAuthErrorMessage,
  getFirebaseIdToken,
  loginWithFirebase,
  logoutFromFirebase,
} from './firebase';

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const REQUESTED_TENANT_ID = (
  import.meta.env.VITE_TENANT_ID ??
  import.meta.env.VITE_FIREBASE_TENANT_ID ??
  ''
).trim();

const DEFAULT_TIMEOUT_MS = 30_000;

// ── Tipos de resposta ─────────────────────────────────────────────────────────

export interface Page<T> {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

export interface ClientResponse {
  id?: string;
  uuid?: string;
  clientId?: string;
  name?: string | null;
  email?: string | null;
  cpf?: string | null;
  active?: boolean;
  akropoliLinkId?: string | null;
  [key: string]: unknown;
}

/**
 * Contrato de GET /clients/{id}/insights, confirmado no backend
 * (ClientController.buildInsights):
 * - avgMonthlyIncome3m: mediana da renda validada dos últimos 6 meses
 *   (base "incomeSemester" — apesar do nome, é mediana semestral, não média 3m);
 * - avgMonthlyIncome12m: mediana da renda validada na janela de 12 meses;
 * - debtToIncomeRatio: totalLiabilities ÷ mediana da renda validada 6m
 *   (null quando a renda é zero) — razão de estoque (saldo devedor), não de
 *   fluxo (parcela/renda);
 * - totalLiabilities: saldo devedor total em BRL dos contratos ativos de
 *   empréstimo/financiamento (LoanInsightsService);
 * - savingsCapacity3m: mediana da renda validada 6m − despesa média mensal 3m;
 * - avgMonthlySpend3m: despesa média mensal (DEBITO) dos últimos 3 meses;
 * - incomeDetected: mediana da renda validada > 0.
 */
export interface ClientInsightsResponse {
  avgMonthlyIncome3m?: number | null;
  avgMonthlyIncome12m?: number | null;
  avgMonthlySpend3m?: number | null;
  debtToIncomeRatio?: number | null;
  healthScore?: number | null;
  history?: unknown[];
  incomeDetected?: boolean;
  lastSyncAt?: string | null;
  savingsCapacity3m?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  [key: string]: unknown;
}

export interface ConsentLinkResponse {
  url?: string;
  link?: string;
  consent?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/**
 * Evento de auditoria abstraído de GET /clients/{id}/audit-events. O backend
 * expõe apenas o tipo neutro (CLIENT_ACCESSED | DOSSIER_EXPORTED |
 * PDF_EXPORTED) e o instante — nunca IP, user-agent ou metadata da trilha.
 */
export interface AuditEventResponse {
  type: 'CLIENT_ACCESSED' | 'DOSSIER_EXPORTED' | 'PDF_EXPORTED' | string;
  occurredAt: string;
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  authenticated?: boolean;
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

// ── Token storage ─────────────────────────────────────────────────────────────

function clearTokens(): void {
  void logoutFromFirebase();
}

// ── Refresh orchestration ─────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  try {
    return await getFirebaseIdToken(true);
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
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function buildUrl(path: string, query?: QueryParams): string {
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

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return fallback;
}

function combineSignals(external: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return external ? AbortSignal.any([external, timeout]) : timeout;
}

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    authenticated = true,
    body,
    query,
    headers,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...rest
  } = options;

  const finalSignal = combineSignals(signal, timeoutMs);

  const doFetch = async (token: string | null): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    };
    if (authenticated && token) finalHeaders.Authorization = `Bearer ${token}`;
    if (authenticated && REQUESTED_TENANT_ID) {
      finalHeaders['X-Tenant-ID'] = REQUESTED_TENANT_ID;
    }

    return fetch(buildUrl(path, query), {
      ...rest,
      signal: finalSignal,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response: Response;
  try {
    response = await doFetch(authenticated ? await getFirebaseIdToken() : null);
  } catch (err) {
    throw toNetworkError(err);
  }

  if (response.status === 401 && authenticated) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      try {
        response = await doFetch(newToken);
      } catch (err) {
        throw toNetworkError(err);
      }
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
    const message = extractMessage(parsed, `Erro ${response.status}`);
    throw new ApiError(response.status, message, parsed);
  }
  return parsed as T;
}

function toNetworkError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return new ApiError(0, 'Requisição cancelada ou tempo esgotado.', err);
  }
  return new ApiError(0, 'Falha de rede. Verifique a conexão com o servidor.', err);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (body: { email: string; password: string }) => {
    try {
      return await loginWithFirebase(body.email, body.password);
    } catch (error) {
      throw new ApiError(401, firebaseAuthErrorMessage(error), error);
    }
  },

  logout: () => logoutFromFirebase(),
};

// ── Banker ────────────────────────────────────────────────────────────────────

export const bankerApi = {
  getMe: () => request('/api/v1/bankers/me'),
};

// ── Clients ───────────────────────────────────────────────────────────────────

export const clientsApi = {
  list: (params?: { page?: number; size?: number; q?: string }, signal?: AbortSignal) => {
    const query: QueryParams = {
      page: params?.page ?? 0,
      size: params?.size ?? 20,
    };
    if (params?.q?.trim()) {
      query.q = params.q.trim();
    }
    return request<Page<ClientResponse>>('/api/v1/clients', { query, signal });
  },

  getById: (id: string, params?: QueryParams, signal?: AbortSignal) =>
    request<ClientResponse>(`/api/v1/clients/${id}`, { query: params, signal }),

  create: (body: Record<string, unknown>) =>
    request<ClientResponse>('/api/v1/clients', { method: 'POST', body }),

  getConsentLink: (id: string) =>
    request<ConsentLinkResponse>(`/api/v1/clients/${id}/consent-link`),

  getLinks: (id: string, signal?: AbortSignal) =>
    request<unknown[]>(`/api/v1/clients/${id}/links`, { signal }),

  sync: (id: string) =>
    request(`/api/v1/clients/${id}/sync`, { method: 'POST' }),

  syncLink: (id: string, linkId: string) =>
    request(`/api/v1/clients/${id}/links/${linkId}/sync`, { method: 'POST' }),

  saveAkropoliLink: (body: Record<string, unknown>) =>
    request('/api/v1/clients/akropoli/link', { method: 'POST', body }),

  getInsights: (id: string, signal?: AbortSignal) =>
    request<ClientInsightsResponse>(`/api/v1/clients/${id}/insights`, { signal }),

  getLoanInsights: (id: string, signal?: AbortSignal) =>
    request(`/api/v1/clients/${id}/insights/loans`, { signal }),

  getCategoryBreakdown: (id: string, params?: QueryParams, signal?: AbortSignal) =>
    request(`/api/v1/clients/${id}/category-breakdown`, { query: params, signal }),

  getIncomeComposition: (id: string, params?: QueryParams, signal?: AbortSignal) =>
    request(`/api/v1/clients/${id}/income-composition`, { query: params, signal }),

  getStatement: (id: string, params?: QueryParams, signal?: AbortSignal) =>
    request(`/api/v1/clients/${id}/statement`, { query: params, signal }),

  getAuditEvents: (id: string, signal?: AbortSignal) =>
    request<AuditEventResponse[]>(`/api/v1/clients/${id}/audit-events`, { signal }),
};
