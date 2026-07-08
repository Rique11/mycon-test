import React from 'react';

const STORAGE_KEY = 'mycon_poc_cases_v1';

const RECENT_LINK_DAYS = 5;

const CONSENT_ACCEPTED_STATUSES = new Set(['conectado', 'maisContas', 'semRenda', 'pronto']);

export const QUEUE_ACTIONS = {
  sendAndWait: 'Link gerado, enviar e aguardar consentimento',
  investigateNoConsent: 'Verificar porque o cliente ainda nao consentiu',
  accessOutputs: 'Consentimento aceito, pronto para acessar o extrato e excel',
};

export const PRODUCT_LABELS = {
  imovel: 'Imóvel',
  veiculo: 'Veículo',
  servico: 'Serviço',
};

export const POC_STATUS = {
  enviado: {
    label: 'Consentimento enviado',
    tone: 'blue',
    owner: 'Cliente',
    nextAction: QUEUE_ACTIONS.sendAndWait,
    statement: 'Aguardando',
    pending: 'Cliente ainda não consentiu.',
  },
  aguardando: {
    label: 'Aguardando consentimento',
    tone: 'warning',
    owner: 'Cliente',
    nextAction: QUEUE_ACTIONS.investigateNoConsent,
    statement: 'Aguardando',
    pending: 'Cliente ainda não consentiu.',
  },
  conectado: {
    label: 'Open Finance conectado',
    tone: 'purple',
    owner: 'Lizard',
    nextAction: QUEUE_ACTIONS.accessOutputs,
    statement: 'Em coleta',
    pending: 'Coleta Open Finance em andamento.',
  },
  maisContas: {
    label: 'Mais contas necessárias',
    tone: 'warning',
    owner: 'Cliente',
    nextAction: QUEUE_ACTIONS.accessOutputs,
    statement: 'Aguardando',
    pending: 'Falta conectar a conta onde recebe renda.',
  },
  semRenda: {
    label: 'Conta sem renda identificada',
    tone: 'danger',
    owner: 'Cliente',
    nextAction: QUEUE_ACTIONS.accessOutputs,
    statement: 'Aguardando',
    pending: 'Banco conectado não possui renda identificada.',
  },
  pronto: {
    label: 'Extrato 12m pronto',
    tone: 'success',
    owner: 'Lizard',
    nextAction: QUEUE_ACTIONS.accessOutputs,
    statement: 'Pronto',
    pending: null,
  },
  expirado: {
    label: 'Expirado sem consentimento',
    tone: 'danger',
    owner: 'Mycon',
    nextAction: QUEUE_ACTIONS.investigateNoConsent,
    statement: 'Aguardando',
    pending: 'Consentimento expirado.',
  },
  escalado: {
    label: 'Escalado para Mycon',
    tone: 'warning',
    owner: 'Mycon',
    nextAction: QUEUE_ACTIONS.investigateNoConsent,
    statement: 'Aguardando',
    pending: 'Caso escalado para Mycon.',
  },
  manual: {
    label: 'Enviado para fluxo manual',
    tone: 'neutral',
    owner: 'Mycon',
    nextAction: QUEUE_ACTIONS.investigateNoConsent,
    statement: 'Aguardando',
    pending: 'Fluxo manual por PDF.',
  },
};

export const POC_FILTERS = [
  { key: 'todos', label: 'Todos', statuses: null },
  { key: 'aguardando', label: 'Consentimento pendente', statuses: ['enviado', 'aguardando', 'expirado'] },
  { key: 'conectado', label: 'Consentimento aceito', statuses: ['conectado', 'maisContas', 'semRenda', 'pronto'] },
  { key: 'pendencia', label: 'Excecoes operacionais', statuses: ['escalado', 'manual'] },
];

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
  const savedCpfs = new Set(savedCases.map((item) => normalizeCpf(item.cpf)).filter(Boolean));
  const missingSeeds = SEED_CASES.filter((item) => !savedIds.has(item.id) && !savedCpfs.has(normalizeCpf(item.cpf)));
  return [...missingSeeds, ...savedCases];
}

export function normalizeCpf(value = '') {
  return String(value).replace(/\D/g, '');
}

export function maskCpf(value = '') {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return value || '';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

export function getStatusMeta(status) {
  return POC_STATUS[status] ?? POC_STATUS.aguardando;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getConsentStatusValue(caseItem) {
  return String(
    caseItem.consent?.status
      || caseItem.consent?.state
      || caseItem.consent?.consentStatus
      || '',
  ).toLowerCase();
}

export function isConsentAccepted(caseItem, options = {}) {
  if (options.evidenceReady) return true;
  if (CONSENT_ACCEPTED_STATUSES.has(caseItem.status)) return true;
  const consentStatus = getConsentStatusValue(caseItem);
  return ['accepted', 'authorized', 'authorised', 'autorizado', 'ativo', 'active'].some((value) =>
    consentStatus.includes(value),
  );
}

export function getConsentGeneratedAt(caseItem) {
  return parseDate(
    caseItem.consentCreatedAt
      || caseItem.linkGeneratedAt
      || caseItem.consent?.createdAt
      || caseItem.consent?.created_at
      || caseItem.createdAt,
  );
}

export function getQueueBusinessRules(caseItem, options = {}) {
  if (isConsentAccepted(caseItem, options)) {
    return {
      key: 'accepted',
      statusLabel: 'Consentimento aceito',
      tone: 'success',
      owner: 'Lizard',
      nextAction: QUEUE_ACTIONS.accessOutputs,
      accepted: true,
    };
  }

  const generatedAt = getConsentGeneratedAt(caseItem);
  const now = parseDate(options.now) || new Date();
  const ageInDays = generatedAt
    ? Math.floor((now.getTime() - generatedAt.getTime()) / 86400000)
    : null;
  const isRecent = ageInDays == null || ageInDays <= RECENT_LINK_DAYS;

  if (isRecent) {
    return {
      key: 'link-gerado',
      statusLabel: 'Link gerado',
      tone: 'blue',
      owner: 'Cliente',
      nextAction: QUEUE_ACTIONS.sendAndWait,
      accepted: false,
    };
  }

  return {
    key: 'sem-consentimento',
    statusLabel: 'Consentimento pendente',
    tone: 'warning',
    owner: 'Lizard',
    nextAction: QUEUE_ACTIONS.investigateNoConsent,
    accepted: false,
  };
}

export function createPocCaseFromForm(form, apiResult = {}) {
  const now = new Date();
  const cpf = normalizeCpf(form.cpf);

  return {
    id: `${form.externalCaseId || `PC-${now.getTime()}`}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    externalCaseId: form.externalCaseId?.trim() || `PC-${now.getTime()}`,
    name: form.name.trim(),
    cpf,
    cpfMasked: maskCpf(cpf),
    phone: normalizeCpf(form.phone),
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
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

  return {
    cases,
    addCase,
    updateCase,
    resetCases,
    nextCaseId: getNextCaseId(cases),
  };
}
