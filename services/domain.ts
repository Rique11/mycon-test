/**
 * domain.ts — regras de negócio puras e constantes de domínio da POC Mycon:
 * status da fila operacional, filtros, regras de consentimento e classificação
 * de lançamentos da composição de renda: agrupamento em receita vs. transferências
 * entre contas do titular, com método de recebimento (PIX, TED, ...) por lançamento.
 */

import { num, ymLabels } from '../lib/format';

export const RECENT_LINK_DAYS = 5;

export const CONSENT_ACCEPTED_STATUSES = new Set(['conectado', 'maisContas', 'semRenda', 'pronto']);

export const QUEUE_ACTIONS = {
  sendAndWait: 'Link gerado, enviar e aguardar consentimento',
  investigateNoConsent: 'Verificar porque o cliente ainda nao consentiu',
  accessOutputs: 'Consentimento aceito, pronto para acessar o extrato e excel',
} as const;

export const PRODUCT_LABELS: Record<string, string> = {
  imovel: 'Imóvel',
  veiculo: 'Veículo',
  servico: 'Serviço',
};

export interface StatusMeta {
  label: string;
  tone: string;
  owner: string;
  nextAction: string;
  statement: string;
  pending: string | null;
}

export const POC_STATUS: Record<string, StatusMeta> = {
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

export interface PocCase {
  id: string;
  status?: string;
  consent?: Record<string, unknown> | null;
  consentCreatedAt?: string;
  linkGeneratedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface QueueRuleOptions {
  evidenceReady?: boolean;
  now?: string | Date;
}

export function getStatusMeta(status: string | undefined): StatusMeta {
  return POC_STATUS[status ?? ''] ?? POC_STATUS.aguardando;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getConsentStatusValue(caseItem: PocCase): string {
  const consent = caseItem.consent ?? {};
  return String(
    (consent as Record<string, unknown>).status
      || (consent as Record<string, unknown>).state
      || (consent as Record<string, unknown>).consentStatus
      || '',
  ).toLowerCase();
}

export function isConsentAccepted(caseItem: PocCase, options: QueueRuleOptions = {}): boolean {
  if (options.evidenceReady) return true;
  if (CONSENT_ACCEPTED_STATUSES.has(caseItem.status ?? '')) return true;
  const consentStatus = getConsentStatusValue(caseItem);
  return ['accepted', 'authorized', 'authorised', 'autorizado', 'ativo', 'active'].some((value) =>
    consentStatus.includes(value),
  );
}

export function getConsentGeneratedAt(caseItem: PocCase): Date | null {
  const consent = (caseItem.consent ?? {}) as Record<string, unknown>;
  return parseDate(
    caseItem.consentCreatedAt
      || caseItem.linkGeneratedAt
      || consent.createdAt
      || consent.created_at
      || caseItem.createdAt,
  );
}

export interface QueueBusinessRules {
  key: string;
  statusLabel: string;
  tone: string;
  owner: string;
  nextAction: string;
  accepted: boolean;
}

export function getQueueBusinessRules(caseItem: PocCase, options: QueueRuleOptions = {}): QueueBusinessRules {
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

// ── Classificação de lançamentos da composição de renda ──────────────────────

export const CLS_KEY: Record<string, string> = { REC: 'rec', PIX: 'pix', ENT: 'ent', NREC: 'nrec', ATIP: 'atip' };

export const GROUP_ORDER: Array<[string, string]> = [
  ['receita', 'A. Receita'],
  ['ent', 'B. Entre contas (Pessoa Física)'],
];

export const RECEIPT_METHODS = ['PIX', 'TED', 'DOC', 'Boleto', 'Resgate', 'Outros'] as const;

export function receiptMethod(description: unknown): string {
  const d = String(description || '').toUpperCase();
  if (/\bPIX\b/.test(d)) return 'PIX';
  if (/\bTED\b/.test(d)) return 'TED';
  if (/\bDOC\b/.test(d)) return 'DOC';
  if (d.includes('BOLETO')) return 'Boleto';
  if (d.includes('RESGATE')) return 'Resgate';
  return 'Outros';
}

export function confTone(conf: string | undefined): string {
  if (conf === 'Alta') return 'success';
  if (conf === 'Média' || conf === 'Media') return 'warning';
  return 'danger';
}

export interface MonthComposition {
  id: string;
  label: string;
  long: string;
  rec: number;
  pix: number;
  ent: number;
  nrec: number;
  atip: number;
  total: number;
  val: number;
  conf: string;
  entryCount: number;
  pixTotal: number;
  avgEntry: number;
  maxEntry: number;
}

/**
 * Mapeia um mês bruto da API para o formato de exibição, agregando o
 * detalhamento de lançamentos (`lines`) desse mês para derivar a
 * quantidade de entradas, o total recebido via PIX (recorrente e não
 * recorrente), o valor médio por entrada e a maior entrada recebida.
 */
export function mapMonth(mo: Record<string, unknown>, lines: Array<Record<string, unknown>> = []): MonthComposition {
  const { label, long } = ymLabels(mo.yearMonth);
  const total = num(mo.totalCredits);
  const list = Array.isArray(lines) ? lines : [];
  const entryCount = list.length;
  const pixTotal = list.reduce((acc, l) => (
    receiptMethod(l.description) === 'PIX' ? acc + num(l.amount) : acc
  ), 0);
  const maxEntry = list.reduce((acc, l) => Math.max(acc, num(l.amount)), 0);
  return {
    id: String(mo.yearMonth), label, long,
    rec: num(mo.recurring), pix: num(mo.pixRecurring), ent: num(mo.betweenAccounts),
    nrec: num(mo.nonRecurring), atip: num(mo.atypical),
    total, val: num(mo.validatedIncome),
    conf: String(mo.confidence || 'Baixa'),
    entryCount, pixTotal,
    avgEntry: entryCount > 0 ? total / entryCount : 0,
    maxEntry,
  };
}

export interface ReceitaStats {
  media12m: number | null;
  volatilidade: number | null;
}

/**
 * Deriva receita média mensal (12m) e volatilidade (coeficiente de variação
 * das entradas totais mensais) a partir de um payload de composição de renda
 * (`{ months, summary }`), para uso em cards de evidência de renda.
 */
export function computeReceitaStats(
  income: { months?: Array<Record<string, unknown>>; summary?: { monthsAnalyzed?: number } } | null | undefined,
): ReceitaStats {
  const meses = (income?.months || []).map((mo) => mapMonth(mo));
  const mesesAnalisados = income?.summary?.monthsAnalyzed || meses.length;
  const somaEntradas = meses.reduce((a, m) => a + m.total, 0);
  const media12m = mesesAnalisados > 0 ? somaEntradas / mesesAnalisados : null;

  const totaisMensais = meses.map((m) => m.total);
  let volatilidade: number | null = null;
  if (totaisMensais.length >= 2) {
    const media = totaisMensais.reduce((a, v) => a + v, 0) / totaisMensais.length;
    if (media > 0) {
      const variancia = totaisMensais.reduce((a, v) => a + (v - media) ** 2, 0) / totaisMensais.length;
      volatilidade = Math.sqrt(variancia) / media;
    }
  }

  return { media12m, volatilidade };
}

export interface DetailLine {
  d: unknown;
  desc: string;
  inst: string;
  val: number;
  cls: string;
  met: string;
  cons: boolean;
  obs: string;
}

export function groupDetail(lines: Array<Record<string, unknown>> | null | undefined): Record<string, { title: string; items: DetailLine[] }> {
  const groups: Record<string, { title: string; items: DetailLine[] }> = {};
  GROUP_ORDER.forEach(([key, title]) => { groups[key] = { title, items: [] }; });
  (lines || []).forEach((l) => {
    const key = String(l.classification) === 'ENT' ? 'ent' : 'receita';
    groups[key].items.push({
      d: l.date, desc: String(l.description || '—'), inst: String(l.personType || '—'),
      val: num(l.amount), cls: CLS_KEY[String(l.classification)] || 'nrec',
      met: receiptMethod(l.description), cons: !!l.considered, obs: '',
    });
  });
  return groups;
}
