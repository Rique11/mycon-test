/**
 * useStatement.ts — Hook para carregar o extrato normalizado do cliente
 * (endpoint /clients/{id}/statement), com cancelamento automático quando os
 * parâmetros mudam ou o componente desmonta.
 */

import { clientsApi, type ApiError } from '../services/api';
import { useApiResource } from './useApiResource';

export interface UseStatementResult {
  data: unknown | null;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

export function useStatement(
  clientId: string | null,
  params?: { from?: string; to?: string },
): UseStatementResult {
  const from = params?.from;
  const to = params?.to;

  return useApiResource<unknown>(
    (signal) => clientsApi.getStatement(clientId as string, { from, to }, signal),
    [clientId, from, to],
    { enabled: !!clientId, errorMessage: 'Erro ao carregar extrato' },
  );
}
