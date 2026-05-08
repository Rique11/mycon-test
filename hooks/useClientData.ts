/**
 * useClientData.ts — Hook para carregar dados de cliente e insights da API.
 */

import React from 'react';
import { clientsApi, ApiError } from '../services/api';
import type { ClientResponse, ClientInsightsResponse } from '../services/api';

export interface ClientData {
  client: ClientResponse | null;
  insights: ClientInsightsResponse | null;
}

export interface UseClientDataResult {
  data: ClientData;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

export function useClientData(clientId: string | null): UseClientDataResult {
  const [data, setData] = React.useState<ClientData>({ client: null, insights: null });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [clientData, insightsData] = await Promise.all([
        clientsApi.getById(clientId),
        clientsApi.getInsights(clientId),
      ]);

      setData({
        client: clientData,
        insights: insightsData,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(500, 'Erro ao carregar dados', err));
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    retry: fetchData,
  };
}
