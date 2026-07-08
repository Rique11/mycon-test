/**
 * usePocCases.js — hook de estado e persistência (localStorage) dos casos da
 * fila operacional da POC, com criação de caso a partir do formulário.
 * Regras de negócio puras vivem em services/domain; seeds em services/pocSeeds.
 */

import React from 'react';
import { maskCpf, onlyDigits } from '../lib/format';
import { SEED_CASES } from '../services/pocSeeds';

const STORAGE_KEY = 'mycon_poc_cases_v1';

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function evidenceHashFromCaseId(caseId) {
  return `POC-${String(caseId || 'MYCON').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

function mergeSeedCases(savedCases) {
  if (!Array.isArray(savedCases) || savedCases.length === 0) return SEED_CASES;
  const savedIds = new Set(savedCases.map((item) => item.id));
  const savedCpfs = new Set(savedCases.map((item) => onlyDigits(item.cpf)).filter(Boolean));
  const missingSeeds = SEED_CASES.filter((item) => !savedIds.has(item.id) && !savedCpfs.has(onlyDigits(item.cpf)));
  return [...missingSeeds, ...savedCases];
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
  if (typeof window === 'undefined') return SEED_CASES;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return SEED_CASES;
    const parsed = JSON.parse(saved);
    return mergeSeedCases(parsed);
  } catch {
    return SEED_CASES;
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
    setCases(SEED_CASES);
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
