/**
 * usePocCases.js — hook de estado e persistência (localStorage) dos casos da
 * fila operacional da POC, com seeds de demonstração e criação de caso a
 * partir do formulário. Regras de negócio puras vivem em services/domain.
 */

import React from 'react';
import { maskCpf, onlyDigits } from '../lib/format';

const STORAGE_KEY = 'mycon_poc_cases_v1';

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function evidenceHashFromCaseId(caseId) {
  return `POC-${String(caseId || 'MYCON').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

const SEED_CASES = [
  {
    id: 'pc-2051-cliente-teste',
    externalCaseId: 'PC-2051',
    name: 'Cliente Teste',
    cpf: '12345678900',
    cpfMasked: '123.***.***-00',
    phone: '11999990000',
    email: 'cliente.teste@example.com',
    group: '—',
    quota: '—',
    product: 'imovel',
    letterValue: '—',
    contemplationDate: '2026-06-28',
    banks: [],
    status: 'conectado',
    updatedAtLabel: '28/06/26',
    createdAt: '2026-06-28T12:00:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Caso sintético para validar abertura do RaioX pela fila operacional.',
  },
  {
    id: 'pc-2041',
    externalCaseId: 'PC-2041',
    name: 'Mariana Costa',
    cpf: '32145678909',
    cpfMasked: '321.***.***-09',
    phone: '11990010001',
    email: 'mariana.costa@email.com',
    group: '1032',
    quota: '112',
    product: 'imovel',
    letterValue: 'R$ 420.000,00',
    contemplationDate: '2025-05-12',
    banks: ['Itau', 'Nubank'],
    status: 'pronto',
    updatedAtLabel: 'Hoje, 09:42',
    createdAt: '2025-05-12T09:42:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Mock da POC navegavel.',
  },
  {
    id: 'pc-2042',
    externalCaseId: 'PC-2042',
    name: 'Roberto Lima',
    cpf: '65498712344',
    cpfMasked: '654.***.***-44',
    phone: '11990010002',
    email: 'roberto.lima@email.com',
    group: '0871',
    quota: '044',
    product: 'veiculo',
    letterValue: 'R$ 118.000,00',
    contemplationDate: '2025-05-13',
    banks: ['Santander'],
    status: 'conectado',
    updatedAtLabel: 'Hoje, 08:17',
    createdAt: '2025-05-13T08:17:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Coleta Open Finance simulada.',
  },
  {
    id: 'pc-2043',
    externalCaseId: 'PC-2043',
    name: 'Camila Rocha',
    cpf: '23198745612',
    cpfMasked: '231.***.***-12',
    phone: '11990010003',
    email: 'camila.rocha@email.com',
    group: '1190',
    quota: '305',
    product: 'imovel',
    letterValue: 'R$ 690.000,00',
    contemplationDate: '2025-05-14',
    banks: [],
    status: 'enviado',
    updatedAtLabel: 'Ontem, 17:06',
    createdAt: '2025-05-14T17:06:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Link enviado no mock.',
  },
  {
    id: 'pc-2044',
    externalCaseId: 'PC-2044',
    name: 'Eduardo Martins',
    cpf: '78912345688',
    cpfMasked: '789.***.***-88',
    phone: '11990010004',
    email: 'eduardo.martins@email.com',
    group: '0550',
    quota: '019',
    product: 'servico',
    letterValue: 'R$ 38.000,00',
    contemplationDate: '2025-05-14',
    banks: [],
    status: 'aguardando',
    updatedAtLabel: 'Ontem, 11:21',
    createdAt: '2025-05-14T11:21:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Aguardando aceite.',
  },
  {
    id: 'pc-2045',
    externalCaseId: 'PC-2045',
    name: 'Fernanda Alves',
    cpf: '14725836977',
    cpfMasked: '147.***.***-77',
    phone: '11990010005',
    email: 'fernanda.alves@email.com',
    group: '0766',
    quota: '208',
    product: 'imovel',
    letterValue: 'R$ 350.000,00',
    contemplationDate: '2025-05-15',
    banks: ['Caixa'],
    status: 'maisContas',
    updatedAtLabel: '16/05, 15:10',
    createdAt: '2025-05-15T15:10:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Precisa conectar conta de renda.',
  },
  {
    id: 'pc-2046',
    externalCaseId: 'PC-2046',
    name: 'Thiago Nunes',
    cpf: '96385274133',
    cpfMasked: '963.***.***-33',
    phone: '11990010006',
    email: 'thiago.nunes@email.com',
    group: '0912',
    quota: '077',
    product: 'veiculo',
    letterValue: 'R$ 92.000,00',
    contemplationDate: '2025-05-15',
    banks: ['Banco do Brasil'],
    status: 'semRenda',
    updatedAtLabel: '16/05, 10:04',
    createdAt: '2025-05-15T10:04:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Banco conectado não trouxe renda.',
  },
  {
    id: 'pc-2047',
    externalCaseId: 'PC-2047',
    name: 'Patricia Gomes',
    cpf: '85274196310',
    cpfMasked: '852.***.***-10',
    phone: '11990010007',
    email: 'patricia.gomes@email.com',
    group: '1301',
    quota: '144',
    product: 'imovel',
    letterValue: 'R$ 510.000,00',
    contemplationDate: '2025-05-10',
    banks: [],
    status: 'expirado',
    updatedAtLabel: '15/05, 18:33',
    createdAt: '2025-05-10T18:33:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Consentimento expirado no mock.',
  },
  {
    id: 'pc-2048',
    externalCaseId: 'PC-2048',
    name: 'Lucas Pereira',
    cpf: '15935725866',
    cpfMasked: '159.***.***-66',
    phone: '11990010008',
    email: 'lucas.pereira@email.com',
    group: '0644',
    quota: '281',
    product: 'servico',
    letterValue: 'R$ 26.500,00',
    contemplationDate: '2025-05-11',
    banks: ['Inter'],
    status: 'escalado',
    updatedAtLabel: '14/05, 13:55',
    createdAt: '2025-05-11T13:55:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Escalado para definição Mycon.',
  },
  {
    id: 'pc-2049',
    externalCaseId: 'PC-2049',
    name: 'Ana Beatriz',
    cpf: '35715948655',
    cpfMasked: '357.***.***-55',
    phone: '11990010009',
    email: 'ana.beatriz@email.com',
    group: '0732',
    quota: '098',
    product: 'veiculo',
    letterValue: 'R$ 76.000,00',
    contemplationDate: '2025-05-12',
    banks: [],
    status: 'manual',
    updatedAtLabel: '13/05, 16:18',
    createdAt: '2025-05-12T16:18:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Fluxo manual por PDF.',
  },
  {
    id: 'pc-2050',
    externalCaseId: 'PC-2050',
    name: 'Gustavo Henrique',
    cpf: '75395145622',
    cpfMasked: '753.***.***-22',
    phone: '11990010010',
    email: 'gustavo.henrique@email.com',
    group: '1419',
    quota: '033',
    product: 'imovel',
    letterValue: 'R$ 605.000,00',
    contemplationDate: '2025-05-16',
    banks: ['Bradesco', 'Nubank'],
    status: 'pronto',
    updatedAtLabel: 'Hoje, 10:22',
    createdAt: '2025-05-16T10:22:00.000Z',
    consentLink: '',
    clientId: null,
    notes: 'Extrato consolidado pronto no mock.',
  },
];

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
