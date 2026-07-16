/**
 * useClientInstitutions.js — hook que resolve, para cada cliente da API, os
 * nomes das instituições financeiras conectadas (GET /clients/{id}/links,
 * campo institutionName dos vínculos não revogados), com cache em memória por
 * sessão. Alimenta a coluna de bancos da fila operacional, que antes só
 * conhecia os bancos de um caso após a abertura do drawer. Falhas de rede não
 * são cacheadas — a busca é refeita na próxima carga da lista.
 */

import React from 'react';
import { clientsApi } from '../services/api';
import { normalizeBankLabel } from '../services/institutions.js';
import { getClientId } from '../services/clientResolution.js';

const cache = new Map();

function linkInstitutionNames(result) {
  const links = Array.isArray(result) ? result : result?.content || [];
  return Array.from(new Set(
    links
      .filter((link) => String(link?.status || '').toUpperCase() !== 'REVOKED')
      .map((link) => normalizeBankLabel(link?.institutionName))
      .filter(Boolean),
  ));
}

export function useClientInstitutions(clients) {
  const [byClient, setByClient] = React.useState(() => Object.fromEntries(cache));

  React.useEffect(() => {
    let cancelled = false;
    const pending = (clients || [])
      .map(getClientId)
      .filter(Boolean)
      .map(String)
      .filter((id) => !cache.has(id));
    if (!pending.length) return undefined;

    (async () => {
      await Promise.all(pending.map(async (id) => {
        try {
          cache.set(id, linkInstitutionNames(await clientsApi.getLinks(id)));
        } catch {
          // Erro de rede/API: não cacheia para tentar de novo na próxima carga.
        }
      }));
      if (!cancelled) setByClient(Object.fromEntries(cache));
    })();

    return () => {
      cancelled = true;
    };
  }, [clients]);

  return byClient;
}
