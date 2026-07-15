/**
 * clientSync.ts — garante a coleta inicial dos dados Open Finance de um cliente.
 * Quando a conexão está ativa (akropoliLinkId presente) mas nenhuma sincronização
 * ocorreu (lastSyncAt nulo), dispara o sync na API e aguarda, com polling limitado
 * dos insights, até a coleta refletir nos dados. Falhas do sync não interrompem a
 * tela: os insights originais são retornados como melhor esforço.
 */

import { clientsApi, type ClientResponse, type ClientInsightsResponse } from './api';

const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 2000;

export function needsInitialSync(
  client: ClientResponse | null | undefined,
  insights: ClientInsightsResponse | null | undefined,
): boolean {
  return Boolean(client?.akropoliLinkId) && !insights?.lastSyncAt;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort);
    }
  });
}

export async function ensureClientSynced(
  id: string,
  client: ClientResponse | null | undefined,
  insights: ClientInsightsResponse | null | undefined,
  signal?: AbortSignal,
): Promise<ClientInsightsResponse | null> {
  const current = insights ?? null;
  if (!needsInitialSync(client, current)) return current;

  try {
    await clientsApi.sync(id);
  } catch {
    return current;
  }

  let latest = current;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await delay(POLL_INTERVAL_MS, signal);
    try {
      latest = await clientsApi.getInsights(id, signal);
    } catch (err) {
      if (signal?.aborted) throw err;
      continue;
    }
    if (latest?.lastSyncAt) return latest;
  }
  return latest;
}
