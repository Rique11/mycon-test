/**
 * domain.ts — regras de negócio puras e constantes de domínio da POC Mycon:
 * status da fila operacional, filtros, regras de consentimento e classificação
 * de lançamentos da composição de renda: agrupamento em receita vs. transferências
 * entre contas do titular, com método de recebimento (PIX, TED, ...) por lançamento,
 * detecção de renda recorrente (valor repetido em meses consecutivos ou mesma fonte
 * pagadora em meses consecutivos), receita trimestral (últimos 3 meses) e o
 * detalhamento por mês da renda recorrente (grupo "C. Renda Recorrente"), com um
 * status por lançamento indicando há quantos meses a renda é recorrente ou, quando
 * a recorrência já terminou, o período em que ela esteve ativa.
 */

import { num, ymLabels, mesLabel } from '../lib/format';

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
  receita: number;
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
 * `receita` é a renda considerada do mês: total de entradas menos as
 * transferências entre contas do próprio titular (`betweenAccounts`), que
 * ficam separadas para avaliação do analista e não compõem a renda, evitando
 * dupla contagem e a inclusão de movimentação de patrimônio.
 */
export function mapMonth(mo: Record<string, unknown>, lines: Array<Record<string, unknown>> = []): MonthComposition {
  const { label, long } = ymLabels(mo.yearMonth);
  const total = num(mo.totalCredits);
  const betweenAccounts = num(mo.betweenAccounts);
  const list = Array.isArray(lines) ? lines : [];
  const entryCount = list.length;
  const pixTotal = list.reduce((acc, l) => (
    receiptMethod(l.description) === 'PIX' ? acc + num(l.amount) : acc
  ), 0);
  const maxEntry = list.reduce((acc, l) => Math.max(acc, num(l.amount)), 0);
  return {
    id: String(mo.yearMonth), label, long,
    rec: num(mo.recurring), pix: num(mo.pixRecurring), ent: betweenAccounts,
    nrec: num(mo.nonRecurring), atip: num(mo.atypical),
    total, receita: Math.max(0, total - betweenAccounts), val: num(mo.validatedIncome),
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
 * da receita mensal) a partir de um payload de composição de renda
 * (`{ months, summary }`), para uso em cards de evidência de renda. A receita
 * considerada exclui transferências entre contas do titular (`betweenAccounts`).
 */
export function computeReceitaStats(
  income: { months?: Array<Record<string, unknown>>; summary?: { monthsAnalyzed?: number } } | null | undefined,
): ReceitaStats {
  const meses = (income?.months || []).map((mo) => mapMonth(mo));
  const mesesAnalisados = income?.summary?.monthsAnalyzed || meses.length;
  const somaReceita = meses.reduce((a, m) => a + m.receita, 0);
  const media12m = mesesAnalisados > 0 ? somaReceita / mesesAnalisados : null;

  const totaisMensais = meses.map((m) => m.receita);
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

// ── Renda recorrente e receita trimestral ────────────────────────────────────

export const RECURRING_AMOUNT_MIN_MONTHS = 2;
export const RECURRING_SOURCE_MIN_MONTHS = 3;

const SOURCE_STOPWORDS = new Set([
  'PIX', 'TED', 'DOC', 'CRED', 'CREDITO', 'DEBITO', 'RECEBIMENTO', 'RECEBIDA', 'RECEBIDO',
  'TRANSF', 'TRANSFERENCIA', 'ENVIO', 'PAGAMENTO', 'BOLETO', 'DEPOSITO', 'CONTA',
  'DE', 'DA', 'DO', 'DAS', 'DOS', 'EM', 'PARA', 'POR',
]);

/**
 * Deriva a chave da fonte pagadora a partir da descrição do lançamento,
 * removendo acentos, pontuação, números e termos genéricos de método bancário,
 * de modo que "FABRICIO HOOG CRED RECEBIMENTO PIX" e "PIX RECEBIDO FABRICIO HOOG"
 * apontem para a mesma fonte.
 */
export function sourceKey(description: unknown): string {
  return String(description || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !SOURCE_STOPWORDS.has(word) && !/^\d+$/.test(word))
    .sort()
    .join(' ');
}

function ymIndex(ym: unknown): number | null {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return y * 12 + (m - 1);
}

interface MonthRun {
  start: number;
  end: number;
  len: number;
}

/**
 * Agrupa uma lista de índices de mês (ver `ymIndex`) em sequências consecutivas,
 * retornando apenas as sequências com pelo menos `minLen` meses. Base tanto para
 * `consecutiveRunMonths` (usado por `computeRecurringIncome`) quanto para
 * `recurringDetailByMonth`, que precisa saber o início/fim de cada sequência.
 */
function consecutiveRuns(months: Iterable<number>, minLen: number): MonthRun[] {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const runs: MonthRun[] = [];
  let start = 0;
  for (let i = 1; i <= sorted.length; i += 1) {
    if (i === sorted.length || sorted[i] !== sorted[i - 1] + 1) {
      const len = i - start;
      if (len >= minLen) runs.push({ start: sorted[start], end: sorted[i - 1], len });
      start = i;
    }
  }
  return runs;
}

function consecutiveRunMonths(months: Iterable<number>, minLen: number): Set<number> {
  const qualifying = new Set<number>();
  consecutiveRuns(months, minLen).forEach((run) => {
    for (let m = run.start; m <= run.end; m += 1) qualifying.add(m);
  });
  return qualifying;
}

function findRun(months: number[], minLen: number, month: number): MonthRun | null {
  return consecutiveRuns(months, minLen).find((run) => month >= run.start && month <= run.end) ?? null;
}

function pickPrimaryRun(byAmount: MonthRun | null, bySource: MonthRun | null): MonthRun | null {
  if (!byAmount) return bySource;
  if (!bySource) return byAmount;
  return bySource.len > byAmount.len ? bySource : byAmount;
}

function monthIndexToYm(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export interface RecurringIncomeResult {
  total: number;
  entryCount: number;
}

/**
 * Calcula a renda recorrente a partir do detalhamento de lançamentos
 * (`detail` do payload de composição de renda). Um lançamento de crédito é
 * considerado recorrente quando atende a pelo menos um dos critérios:
 *  1. o mesmo valor foi recebido em 2 ou mais meses consecutivos;
 *  2. a mesma fonte pagadora (derivada da descrição) creditou valores em
 *     3 ou mais meses consecutivos.
 * Transferências entre contas do titular (ENT) e créditos atípicos (ATIP)
 * não compõem renda e ficam fora do cálculo.
 */
export function computeRecurringIncome(
  lines: Array<Record<string, unknown>> | null | undefined,
): RecurringIncomeResult {
  const candidates = (lines || [])
    .map((l) => ({
      month: ymIndex(l.yearMonth),
      amountCents: Math.round(num(l.amount) * 100),
      source: sourceKey(l.description),
      amount: num(l.amount),
      classification: String(l.classification || ''),
    }))
    .filter((l) => l.month != null && l.amountCents > 0 && l.classification !== 'ENT' && l.classification !== 'ATIP');

  const monthsByAmount = new Map<number, number[]>();
  const monthsBySource = new Map<string, number[]>();
  candidates.forEach((l) => {
    monthsByAmount.set(l.amountCents, [...(monthsByAmount.get(l.amountCents) || []), l.month as number]);
    if (l.source) {
      monthsBySource.set(l.source, [...(monthsBySource.get(l.source) || []), l.month as number]);
    }
  });

  const amountRuns = new Map<number, Set<number>>();
  monthsByAmount.forEach((months, amountCents) => {
    amountRuns.set(amountCents, consecutiveRunMonths(months, RECURRING_AMOUNT_MIN_MONTHS));
  });
  const sourceRuns = new Map<string, Set<number>>();
  monthsBySource.forEach((months, source) => {
    sourceRuns.set(source, consecutiveRunMonths(months, RECURRING_SOURCE_MIN_MONTHS));
  });

  return candidates.reduce<RecurringIncomeResult>((acc, l) => {
    const byAmount = amountRuns.get(l.amountCents)?.has(l.month as number) ?? false;
    const bySource = l.source ? (sourceRuns.get(l.source)?.has(l.month as number) ?? false) : false;
    if (byAmount || bySource) {
      return { total: acc.total + l.amount, entryCount: acc.entryCount + 1 };
    }
    return acc;
  }, { total: 0, entryCount: 0 });
}

export interface RecurringDetailLine {
  raw: Record<string, unknown>;
  d: unknown;
  desc: string;
  inst: string;
  val: number;
  met: string;
  statusLabel: string;
  statusOngoing: boolean;
}

/**
 * Agrupa por mês (chave `yearMonth`) os lançamentos considerados renda
 * recorrente pelos mesmos critérios de `computeRecurringIncome`, para exibição
 * no grupo "C. Renda Recorrente" do detalhamento mensal. Cada lançamento recebe
 * um `statusLabel`: quando a sequência de meses consecutivos (por valor ou por
 * fonte pagadora) ainda alcança o último mês analisado, o status indica há
 * quantos meses a renda vem se repetindo (`statusOngoing: true`, ex.: "4 meses");
 * quando a sequência terminou antes do último mês analisado, o status indica o
 * período em que a renda foi recorrente (`statusOngoing: false`, ex.: "Jan/25 -
 * Jul/25"), sinalizando nos meses daquele período que a renda deixou de se
 * repetir. Quando um lançamento atende aos dois critérios (valor e fonte), a
 * sequência mais longa é usada como referência do status. Cada item devolve
 * também o lançamento bruto (`raw`) para permitir excluir da listagem
 * genérica de receita (grupo "A") os lançamentos já exibidos no grupo "C",
 * evitando duplicidade entre os dois grupos.
 */
export function recurringDetailByMonth(
  lines: Array<Record<string, unknown>> | null | undefined,
  meses: Array<{ id: string }>,
): Record<string, RecurringDetailLine[]> {
  const result: Record<string, RecurringDetailLine[]> = {};

  const latestMonth = meses.reduce<number | null>((max, m) => {
    const idx = ymIndex(m.id);
    if (idx == null) return max;
    return max == null ? idx : Math.max(max, idx);
  }, null);
  if (latestMonth == null) return result;

  const candidates = (lines || [])
    .map((l) => ({
      raw: l,
      month: ymIndex(l.yearMonth),
      amountCents: Math.round(num(l.amount) * 100),
      source: sourceKey(l.description),
      amount: num(l.amount),
      classification: String(l.classification || ''),
    }))
    .filter((l) => l.month != null && l.amountCents > 0 && l.classification !== 'ENT' && l.classification !== 'ATIP');

  const monthsByAmount = new Map<number, number[]>();
  const monthsBySource = new Map<string, number[]>();
  candidates.forEach((l) => {
    monthsByAmount.set(l.amountCents, [...(monthsByAmount.get(l.amountCents) || []), l.month as number]);
    if (l.source) {
      monthsBySource.set(l.source, [...(monthsBySource.get(l.source) || []), l.month as number]);
    }
  });

  candidates.forEach((l) => {
    const month = l.month as number;
    const byAmount = findRun(monthsByAmount.get(l.amountCents) || [], RECURRING_AMOUNT_MIN_MONTHS, month);
    const bySource = l.source ? findRun(monthsBySource.get(l.source) || [], RECURRING_SOURCE_MIN_MONTHS, month) : null;
    const run = pickPrimaryRun(byAmount, bySource);
    if (!run) return;

    const ongoing = run.end === latestMonth;
    const statusLabel = ongoing
      ? `${run.len} ${run.len === 1 ? 'mês' : 'meses'}`
      : `${mesLabel(monthIndexToYm(run.start))} - ${mesLabel(monthIndexToYm(run.end))}`;

    const ym = monthIndexToYm(month);
    (result[ym] = result[ym] || []).push({
      raw: l.raw,
      d: l.raw.date,
      desc: String(l.raw.description || '—'),
      inst: String(l.raw.personType || '—'),
      val: l.amount,
      met: receiptMethod(l.raw.description),
      statusLabel,
      statusOngoing: ongoing,
    });
  });

  return result;
}

/**
 * Soma a receita dos últimos 3 meses analisados (ordenados por ano-mês),
 * já líquida de transferências entre contas do titular, para exibição da
 * receita trimestral no resumo da composição.
 */
export function receitaTrimestral(meses: MonthComposition[]): number {
  return [...meses]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(-3)
    .reduce((acc, m) => acc + m.receita, 0);
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
