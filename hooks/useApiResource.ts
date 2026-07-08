/**
 * useApiResource.ts — hook genérico para carregar um recurso da API com
 * cancelamento via AbortController, estados de loading/erro e retry.
 * Requisições canceladas por troca de dependências ou unmount são ignoradas,
 * evitando race conditions e setState após unmount.
 */

import React from 'react';
import { ApiError } from '../services/api';

export interface UseApiResourceOptions {
  enabled?: boolean;
  errorMessage?: string;
}

export interface UseApiResourceResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
}

export function useApiResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
  options: UseApiResourceOptions = {},
): UseApiResourceResult<T> {
  const { enabled = true, errorMessage = 'Erro ao carregar dados' } = options;
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  React.useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await fetcherRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError) {
          setError(err);
        } else {
          setError(new ApiError(500, errorMessage, err));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadKey, ...deps]);

  const retry = React.useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, loading, error, retry };
}
