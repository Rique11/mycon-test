/**
 * useLoanInsights.ts — Hook para carregar a exposição a crédito do cliente
 * (endpoint /clients/{id}/insights/loans): contratos ativos de empréstimo e
 * financiamento agregados por tipo de produto e por moeda. O payload vem no
 * envelope InsightResponse ({ data, metadata }) com metadata de freshness.
 */

import { clientsApi, type ApiError } from '../services/api';
import { useApiResource } from './useApiResource';

export interface UseLoanInsightsResult {
  data: unknown | null;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

export function useLoanInsights(clientId: string | null): UseLoanInsightsResult {
  return useApiResource<unknown>(
    (signal) => clientsApi.getLoanInsights(clientId as string, signal),
    [clientId],
    { enabled: !!clientId, errorMessage: 'Erro ao carregar contratos de crédito' },
  );
}
