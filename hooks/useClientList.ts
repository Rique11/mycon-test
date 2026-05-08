/**
 * useClientList.ts — Hook para carregar lista de clientes do banker.
 */

import React from 'react';
import { clientsApi, ApiError } from '../services/api.js';
import type { ClientResponse, Page } from '../services/api';

export interface UseClientListResult {
  clients: ClientResponse[];
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

export function useClientList(): UseClientListResult {
  const [clients, setClients] = React.useState<ClientResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchClients = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await clientsApi.list({ page: 0, size: 100 });
      setClients(response.content || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(500, 'Erro ao carregar clientes', err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    loading,
    error,
    retry: fetchClients,
  };
}
