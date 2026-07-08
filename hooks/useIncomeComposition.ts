/**
 * useIncomeComposition.ts — Hook para carregar a composição mensal da renda
 * verificada do cliente (endpoint /clients/{id}/income-composition), com
 * cancelamento automático quando os parâmetros mudam ou o componente desmonta.
 */

import { clientsApi, type ApiError } from '../services/api';
import { useApiResource } from './useApiResource';

export interface UseIncomeCompositionResult {
  data: unknown | null;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

export function useIncomeComposition(
  clientId: string | null,
  params?: { from?: string; to?: string },
): UseIncomeCompositionResult {
  const from = params?.from;
  const to = params?.to;

  return useApiResource<unknown>(
    (signal) => clientsApi.getIncomeComposition(clientId as string, { from, to }, signal),
    [clientId, from, to],
    { enabled: !!clientId, errorMessage: 'Erro ao carregar composição da renda' },
  );
}
