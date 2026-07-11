/**
 * usePocCases.js — hook de estado e persistência (localStorage) dos casos da
 * fila operacional da POC, com criação de caso a partir do formulário.
 * Exibe apenas casos reais; casos sintéticos de demonstração gravados em
 * versões anteriores são expurgados na leitura. Regras puras em services/domain.
 */

import React from 'react';
import { maskCpf, onlyDigits } from '../lib/format';

const STORAGE_KEY = 'mycon_poc_cases_v1';

// Identificadores dos casos sintéticos de versões anteriores, removidos do
// localStorage na leitura para que somente clientes reais sejam exibidos.
const LEGACY_SEED_IDS = new Set([
  'pc-2051-cliente-teste', 'pc-2041', 'pc-2042', 'pc-2043', 'pc-2044',
  'pc-2045', 'pc-2046', 'pc-2047', 'pc-2048', 'pc-2049', 'pc-2050',
]);

const LEGACY_SEED_CPFS = new Set([
  '12345678900', '32145678909', '65498712344', '23198745612', '78912345688',
  '14725836977', '96385274133', '85274196310', '15935725866', '75395145622',
]);

function isLegacySeed(caseItem) {
  return LEGACY_SEED_IDS.has(String(caseItem?.id || ''))
    || LEGACY_SEED_CPFS.has(onlyDigits(caseItem?.cpf));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function evidenceHashFromCaseId(caseId) {
  return `POC-${String(caseId || 'MYCON').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

export function createPocCaseFromForm(form, apiResult = {}) {
  const now = new Date();
  const cpf = onlyDigits(form.cpf);

  return {
    id: `${form.externalCaseId || `PC-${now.getTime()}`}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    externalCaseId: form.externalCaseId?.trim() || `PC-${now.getTime()}`,
    name: form.name.trim(),
    cpf,
    cpfMasked: maskCpf(cpf),
    phone: onlyDigits(form.phone),
    email: form.email.trim(),
    group: form.group.trim(),
    quota: form.quota.trim(),
    product: form.product,
    letterValue: form.letterValue.trim(),
    contemplationDate: form.contemplationDate,
    banks: [],
    status: 'enviado',
    updatedAtLabel: 'Agora',
    createdAt: now.toISOString(),
    consentCreatedAt: now.toISOString(),
    consentExpiresAt: addDays(now, 7),
    evidenceHash: evidenceHashFromCaseId(form.externalCaseId),
    events: [
      { at: now.toISOString(), label: 'Caso cadastrado na fila operacional', actor: 'Lizard' },
      { at: now.toISOString(), label: 'Link de consentimento gerado pela API', actor: 'Akropoli' },
    ],
    consentLink: apiResult.consentLink || '',
    consent: apiResult.consent || null,
    clientId: apiResult.clientId || null,
    notes: form.notes.trim(),
  };
}

function readInitialCases() {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => !isLegacySeed(item));
  } catch {
    return [];
  }
}

function getNextCaseId(cases) {
  const next = cases.reduce((max, item) => {
    const match = String(item.externalCaseId || '').match(/PC-(\d+)/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 2050) + 1;
  return `PC-${next}`;
}

export function usePocCases() {
  const [cases, setCases] = React.useState(readInitialCases);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
    } catch {
      // Quota excedida ou modo privado: estado permanece apenas em memória.
    }
  }, [cases]);

  const addCase = React.useCallback((newCase) => {
    setCases((current) => [newCase, ...current.filter((item) => item.id !== newCase.id)]);
  }, []);

  const updateCase = React.useCallback((caseId, patch) => {
    setCases((current) =>
      current.map((item) =>
        item.id === caseId
          ? { ...item, ...patch, updatedAtLabel: patch.updatedAtLabel || 'Agora' }
          : item,
      ),
    );
  }, []);

  const resetCases = React.useCallback(() => {
    setCases([]);
  }, []);

  const nextCaseId = React.useMemo(() => getNextCaseId(cases), [cases]);

  return {
    cases,
    addCase,
    updateCase,
    resetCases,
    nextCaseId,
  };
}
