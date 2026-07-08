/**
 * useClientData.ts — Hook para carregar dados de cliente e insights da API,
 * com cancelamento automático quando o clientId muda ou o componente desmonta.
 */

import React from 'react';
import { clientsApi, type ApiError, type ClientResponse, type ClientInsightsResponse } from '../services/api';
import { useApiResource } from './useApiResource';

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

const EMPTY: ClientData = { client: null, insights: null };

export function useClientData(clientId: string | null): UseClientDataResult {
  const { data, loading, error, retry } = useApiResource<ClientData>(
    async (signal) => {
      const [client, insights] = await Promise.all([
        clientsApi.getById(clientId as string, signal),
        clientsApi.getInsights(clientId as string, signal),
      ]);
      return { client, insights };
    },
    [clientId],
    { enabled: !!clientId, errorMessage: 'Erro ao carregar dados' },
  );

  return {
    data: data ?? EMPTY,
    loading,
    error,
    retry,
  };
}
