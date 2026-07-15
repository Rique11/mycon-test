/**
 * useClientData.ts — Hook para carregar dados de cliente e insights da API,
 * com cancelamento automático quando o clientId muda ou o componente desmonta.
 * Quando o cliente tem conexão Open Finance ativa mas nunca foi sincronizado,
 * dispara a coleta inicial (sync) e aguarda os insights refletirem os dados;
 * syncPerformed indica que a coleta foi disparada nesta carga.
 */

import React from 'react';
import { clientsApi, type ApiError, type ClientResponse, type ClientInsightsResponse } from '../services/api';
import { ensureClientSynced, needsInitialSync } from '../services/clientSync';
import { useApiResource } from './useApiResource';

export interface ClientData {
  client: ClientResponse | null;
  insights: ClientInsightsResponse | null;
  syncPerformed: boolean;
}

export interface UseClientDataResult {
  data: ClientData;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

const EMPTY: ClientData = { client: null, insights: null, syncPerformed: false };

export function useClientData(clientId: string | null): UseClientDataResult {
  const { data, loading, error, retry } = useApiResource<ClientData>(
    async (signal) => {
      const [client, insights] = await Promise.all([
        clientsApi.getById(clientId as string, signal),
        clientsApi.getInsights(clientId as string, signal),
      ]);
      const syncPerformed = needsInitialSync(client, insights);
      const syncedInsights = syncPerformed
        ? await ensureClientSynced(clientId as string, client, insights, signal)
        : insights;
      return { client, insights: syncedInsights, syncPerformed };
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
