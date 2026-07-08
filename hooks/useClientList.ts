/**
 * useClientList.ts — Hook para carregar lista de clientes do banker,
 * com cancelamento automático no unmount.
 */

import { clientsApi, type ApiError, type ClientResponse } from '../services/api';
import { useApiResource } from './useApiResource';

export interface UseClientListResult {
  clients: ClientResponse[];
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

export function useClientList(): UseClientListResult {
  const { data, loading, error, retry } = useApiResource<ClientResponse[]>(
    async (signal) => {
      const response = await clientsApi.list({ page: 0, size: 100 }, signal);
      return response.content || [];
    },
    [],
    { errorMessage: 'Erro ao carregar clientes' },
  );

  return {
    clients: data ?? [],
    loading,
    error,
    retry,
  };
}
