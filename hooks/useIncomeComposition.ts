/**
 * useIncomeComposition.ts — Hook para carregar a composição mensal da renda
 * verificada do cliente (endpoint /clients/{id}/income-composition).
 */

import React from 'react';
import { clientsApi, ApiError } from '../services/api.js';

export function useIncomeComposition(clientId: string | null, params?: { from?: string; to?: string }) {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const from = params?.from;
  const to = params?.to;

  const fetchData = React.useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await clientsApi.getIncomeComposition(clientId, { from, to });
      setData(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(500, 'Erro ao carregar composição da renda', err));
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, from, to]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, retry: fetchData };
}
