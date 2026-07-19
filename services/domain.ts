/**
 * domain.ts — regras de negócio puras e constantes de domínio da POC Mycon:
 * status da fila operacional, filtros, regras de consentimento e classificação
 * de lançamentos da composição de renda: agrupamento em receita vs. transferências
 * entre contas do titular, com método de recebimento (PIX, TED, ...) por lançamento,
 * detecção de renda recorrente (valor repetido em meses consecutivos ou mesma fonte
 * pagadora em meses consecutivos), receita trimestral (últimos 3 meses) e o
 * detalhamento por mês da renda recorrente (grupo "C. Renda Recorrente"), com um
 * status por lançamento indicando há quantos meses a renda é recorrente ou, quando
 * a recorrência já terminou, o período em que ela esteve ativa. Inclui a
 * janela de exibição do extrato (statementWindow): 12 meses completos mais
 * o mês corrente parcial, para o analista decidir se os lançamentos do mês
 * em curso agregam à avaliação.
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

// Status locais pré-consentimento que podem ser promovidos para 'conectado'
// quando a API já retorna evidências (extrato ou composição de renda), sem
// sobrescrever exceções operacionais ('escalado', 'manual') nem os status que
// já refletem consentimento aceito.
export const PROMOTABLE_STATUSES = new Set(['enviado', 'aguardando', 'expirado']);

export interface EvidencePayload {
  statement?: { rows?: unknown[] } | null;
  income?: { months?: unknown[] } | null;
}

export function hasReadyEvidence(evidence: EvidencePayload | null | undefined): boolean {
  return (Array.isArray(evidence?.statement?.rows) && evidence.statement.rows.length > 0)
    || (Array.isArray(evidence?.income?.months) && evidence.income.months.length > 0);
}

export function getPromotedStatus(caseItem: PocCase, evidence: EvidencePayload | null | undefined): string | null {
  if (!PROMOTABLE_STATUSES.has(caseItem.status ?? '')) return null;
  return hasReadyEvidence(evidence) ? 'conectado' : null;
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

// Início do consentimento a partir dos vínculos Open Finance da API: o menor
// connectedAt entre os links não revogados. É a fonte primária da data — o
// caso local registra apenas quando o link foi gerado — e a única disponível
// para clientes que entram na fila direto da API, sem caso local.
export function getConsentStartFromLinks(links: unknown[] | null | undefined): Date | null {
  if (!Array.isArray(links)) return null;
  const dates = links
    .map((link) => {
      const record = (link ?? {}) as Record<string, unknown>;
      const revoked = String(record.status ?? '').toUpperCase() === 'REVOKED';
      return revoked ? null : parseDate(record.connectedAt);
    })
    .filter((date): date is Date => date != null);
  if (!dates.length) return null;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
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
  parcial: boolean;
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
    parcial: isMesCorrente(String(mo.yearMonth)),
    entryCount, pixTotal,
    avgEntry: entryCount > 0 ? total / entryCount : 0,
    maxEntry,
  };
}

export interface RendaStats {
  media12m: number | null;
  volatilidade: number | null;
}

export type ClientRecencyOrder = 'recentes' | 'antigos';

/**
 * Ordena a lista de clientes por data de cadastro (`createdAt`): 'recentes'
 * exibe do mais novo para o mais antigo, 'antigos' inverte. Clientes sem
 * `createdAt` parseável ficam ao final, preservando a ordem da API entre si.
 * Quando nenhum cliente traz `createdAt`, a ordem da API é tratada como proxy
 * cronológico (listagem por inserção): 'antigos' mantém a ordem recebida e
 * 'recentes' a inverte. O parse usa `Date.parse` apenas para comparação
 * relativa — nenhum valor é reformatado para exibição.
 */
export function sortClientsByRecency<T extends Record<string, unknown>>(
  clients: T[] | null | undefined,
  order: ClientRecencyOrder,
): T[] {
  const entries = (clients || []).map((client, idx) => {
    const parsed = Date.parse(String(client?.createdAt ?? ''));
    return { client, idx, ts: Number.isFinite(parsed) ? parsed : null };
  });
  const dated = entries.filter((e) => e.ts != null);
  const undated = entries.filter((e) => e.ts == null);

  if (dated.length === 0) {
    const proxy = order === 'antigos' ? entries : [...entries].reverse();
    return proxy.map((e) => e.client);
  }

  dated.sort((a, b) => {
    const delta = order === 'antigos' ? (a.ts ?? 0) - (b.ts ?? 0) : (b.ts ?? 0) - (a.ts ?? 0);
    return delta || a.idx - b.idx;
  });
  return [...dated, ...undated].map((e) => e.client);
}

/** Converte um yearMonth (YYYY-MM) em índice absoluto de mês; null se inválido. */
function monthIndex(ym: unknown): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(String(ym ?? ''));
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 12 + (month - 1);
}

/**
 * Deriva média mensal (12m) e volatilidade (coeficiente de variação) da renda
 * verificada (`validatedIncome`, pagadores recorrentes) a partir de um payload
 * de composição de renda (`{ fromYearMonth, toYearMonth, months, summary }`).
 * A série considera apenas meses completos e cobre a janela analisada inteira:
 * o mês corrente parcial é excluído e meses sem crédito algum (ausentes de
 * `months`) contam como zero — renda presente em poucos meses da janela não
 * pode aparentar estabilidade. O tamanho da janela vem de `fromYearMonth`/
 * `toYearMonth` do próprio payload, descontando o mês corrente parcial;
 * `summary.monthsAnalyzed` é usado apenas como fallback quando o período não
 * vem no payload, pois o contrato não garante se essa contagem inclui ou não
 * o mês parcial (semântica a confirmar no backend).
 */
export function computeRendaStats(
  income: {
    fromYearMonth?: unknown;
    toYearMonth?: unknown;
    months?: Array<Record<string, unknown>>;
    summary?: { monthsAnalyzed?: number };
  } | null | undefined,
): RendaStats {
  const meses = (income?.months || []).map((mo) => mapMonth(mo)).filter((m) => !m.parcial);

  const fromIdx = monthIndex(income?.fromYearMonth);
  const toIdx = monthIndex(income?.toYearMonth);
  const janelaCompleta = fromIdx != null && toIdx != null && toIdx >= fromIdx
    ? toIdx - fromIdx + 1 - (isMesCorrente(income?.toYearMonth) ? 1 : 0)
    : income?.summary?.monthsAnalyzed || meses.length;
  const mesesAnalisados = Math.max(janelaCompleta, meses.length);
  const serie = meses.map((m) => m.val);
  while (serie.length < mesesAnalisados) serie.push(0);

  const media12m = mesesAnalisados > 0
    ? serie.reduce((a, v) => a + v, 0) / mesesAnalisados
    : null;

  let volatilidade: number | null = null;
  if (serie.length >= 2) {
    const media = serie.reduce((a, v) => a + v, 0) / serie.length;
    if (media > 0) {
      const variancia = serie.reduce((a, v) => a + (v - media) ** 2, 0) / serie.length;
      volatilidade = Math.sqrt(variancia) / media;
    }
  }

  return { media12m, volatilidade };
}

// ── Renda recorrente e receita trimestral ────────────────────────────────────

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

/**
 * Um lançamento compõe a renda recorrente quando o backend o classificou como
 * tal: `considered === true` (entra na renda validada) ou, na ausência do
 * campo, classificação REC (pagador recorrente em ≥4 meses distintos) ou PIX
 * (PIX recorrente validável). Definição única — a mesma do
 * IncomeCompositionService e da aba de Auditoria do Excel.
 */
function isRecurringLine(line: Record<string, unknown>): boolean {
  if (typeof line.considered === 'boolean') return line.considered;
  const cls = String(line.classification || '');
  return cls === 'REC' || cls === 'PIX';
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
 * Soma a renda recorrente a partir do detalhamento de lançamentos (`detail` do
 * payload de composição de renda), usando a classificação do backend
 * (`isRecurringLine`): créditos REC/PIX considerados na renda validada.
 * Transferências entre contas (ENT), não recorrentes (NREC) e atípicos (ATIP)
 * ficam fora.
 */
export function computeRecurringIncome(
  lines: Array<Record<string, unknown>> | null | undefined,
): RecurringIncomeResult {
  return (lines || []).reduce<RecurringIncomeResult>((acc, l) => {
    const amount = num(l.amount);
    if (amount > 0 && isRecurringLine(l)) {
      return { total: acc.total + amount, entryCount: acc.entryCount + 1 };
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
 * Agrupa por mês (chave `yearMonth`) os lançamentos que o backend classificou
 * como renda recorrente (`isRecurringLine` — mesma definição de
 * `computeRecurringIncome`), para exibição no grupo "C. Renda Recorrente" do
 * detalhamento mensal. O `statusLabel` de cada lançamento é apenas
 * apresentação: a fonte pagadora (derivada da descrição via `sourceKey`)
 * localiza os meses distintos em que aquele pagador creditou renda recorrente;
 * quando o pagador aparece no último mês analisado, o status indica em quantos
 * meses a renda se repete (`statusOngoing: true`, ex.: "4 meses"); quando não
 * aparece mais, indica o período em que foi recorrente (`statusOngoing: false`,
 * ex.: "Jan/25 - Jul/25"). Cada item devolve também o lançamento bruto (`raw`)
 * para permitir excluir da listagem genérica de receita (grupo "A") os
 * lançamentos já exibidos no grupo "C", evitando duplicidade.
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
      source: sourceKey(l.description),
      amount: num(l.amount),
    }))
    .filter((l) => l.month != null && l.amount > 0 && isRecurringLine(l.raw));

  const monthsBySource = new Map<string, Set<number>>();
  candidates.forEach((l) => {
    if (!l.source) return;
    const months = monthsBySource.get(l.source) || new Set<number>();
    months.add(l.month as number);
    monthsBySource.set(l.source, months);
  });

  candidates.forEach((l) => {
    const month = l.month as number;
    const sourceMonths = l.source
      ? [...(monthsBySource.get(l.source) || new Set<number>())].sort((a, b) => a - b)
      : [month];
    const first = sourceMonths[0];
    const last = sourceMonths[sourceMonths.length - 1];
    const ongoing = last === latestMonth;
    const count = sourceMonths.length;
    const statusLabel = ongoing
      ? `${count} ${count === 1 ? 'mês' : 'meses'}`
      : `${mesLabel(monthIndexToYm(first))} - ${mesLabel(monthIndexToYm(last))}`;

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

// ── Recomendação de crédito (multifator, configurável pelo analista) ──────────

/**
 * Critérios de aceite da empresa, ajustáveis na tela de análise. `rendaMinima`
 * em reais/mês; `debitoRendaMax` como razão Débito/Renda (contrato do backend
 * `debtToIncomeRatio`); `volatilidadeMax` como coeficiente de variação (0–1);
 * `mesesRecorrentesMin` como quantidade mínima de meses com renda recorrente.
 */
export interface DecisionCriteria {
  rendaMinima: number;
  debitoRendaMax: number;
  volatilidadeMax: number;
  mesesRecorrentesMin: number;
}

export const DEFAULT_DECISION_CRITERIA: DecisionCriteria = {
  rendaMinima: 1500,
  debitoRendaMax: 3,
  volatilidadeMax: 0.4,
  mesesRecorrentesMin: 4,
};

export interface DecisionMetrics {
  rendaVerificada: number | null;
  debitoRenda: number | null;
  volatilidade: number | null;
  mesesRecorrentes: number | null;
}

export type DecisionLevel = 'aprovar' | 'revisar' | 'complementar';

export interface DecisionCheck {
  key: string;
  label: string;
  ok: boolean;
  value: number | null;
  threshold: number;
  comparator: 'gte' | 'lte';
  format: 'money' | 'multiple' | 'pct' | 'int';
}

export interface DecisionResult {
  level: DecisionLevel;
  incomeProven: boolean;
  checks: DecisionCheck[];
}

function toNonNegativeNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Normaliza os critérios vindos do armazenamento local ou de formulário,
 * preenchendo com os defaults qualquer campo ausente ou inválido, para que a
 * avaliação nunca receba NaN/negativo.
 */
export function sanitizeDecisionCriteria(raw: Partial<DecisionCriteria> | null | undefined): DecisionCriteria {
  const base = raw ?? {};
  return {
    rendaMinima: toNonNegativeNumber(base.rendaMinima, DEFAULT_DECISION_CRITERIA.rendaMinima),
    debitoRendaMax: toNonNegativeNumber(base.debitoRendaMax, DEFAULT_DECISION_CRITERIA.debitoRendaMax),
    volatilidadeMax: toNonNegativeNumber(base.volatilidadeMax, DEFAULT_DECISION_CRITERIA.volatilidadeMax),
    mesesRecorrentesMin: Math.round(toNonNegativeNumber(base.mesesRecorrentesMin, DEFAULT_DECISION_CRITERIA.mesesRecorrentesMin)),
  };
}

/**
 * Avalia a recomendação de crédito a partir das métricas de renda verificada e
 * dos critérios de aceite da empresa. Sem renda comprovável (renda verificada
 * > 0 e meses recorrentes ≥ mínimo) a recomendação é sempre "complementar"; com
 * renda comprovável, "aprovar" quando todos os critérios secundários passam e
 * "revisar" quando algum falha. Fatores sem dado (null) não reprovam, evitando
 * negar por ausência de informação.
 */
export function evaluateDecision(
  metrics: DecisionMetrics,
  criteriaRaw?: Partial<DecisionCriteria> | null,
): DecisionResult {
  const criteria = sanitizeDecisionCriteria(criteriaRaw);
  const renda = metrics.rendaVerificada ?? 0;
  const meses = metrics.mesesRecorrentes ?? 0;
  const incomeProven = renda > 0 && meses >= criteria.mesesRecorrentesMin;

  const checks: DecisionCheck[] = [
    {
      key: 'recorrencia',
      label: 'Meses com renda recorrente',
      ok: meses >= criteria.mesesRecorrentesMin,
      value: meses,
      threshold: criteria.mesesRecorrentesMin,
      comparator: 'gte',
      format: 'int',
    },
    {
      key: 'renda',
      label: 'Renda verificada mínima',
      ok: renda >= criteria.rendaMinima,
      value: metrics.rendaVerificada,
      threshold: criteria.rendaMinima,
      comparator: 'gte',
      format: 'money',
    },
    {
      key: 'debito',
      label: 'Débito/Renda máximo',
      ok: metrics.debitoRenda == null || metrics.debitoRenda <= criteria.debitoRendaMax,
      value: metrics.debitoRenda,
      threshold: criteria.debitoRendaMax,
      comparator: 'lte',
      format: 'multiple',
    },
    {
      key: 'volatilidade',
      label: 'Volatilidade máxima',
      ok: metrics.volatilidade == null || metrics.volatilidade <= criteria.volatilidadeMax,
      value: metrics.volatilidade,
      threshold: criteria.volatilidadeMax,
      comparator: 'lte',
      format: 'pct',
    },
  ];

  let level: DecisionLevel;
  if (!incomeProven) {
    level = 'complementar';
  } else if (checks.every((c) => c.ok)) {
    level = 'aprovar';
  } else {
    level = 'revisar';
  }

  return { level, incomeProven, checks };
}

// ── Tendência e perfil da renda verificada ───────────────────────────────────

export type TendenciaRenda = 'crescente' | 'estavel' | 'decrescente';

export interface TendenciaRendaResult {
  tendencia: TendenciaRenda | null;
  variacao: number | null;
}

/**
 * Tendência retrospectiva da renda verificada: compara a média dos 3 últimos
 * meses da janela com a média dos 3 meses imediatamente anteriores. A série é
 * posicionada pelo intervalo `fromYearMonth`/`toYearMonth` do payload (fallback:
 * primeiro/último mês com dados), preenchendo com zero os meses sem crédito —
 * um mês sem renda pesa na tendência, não é ignorado. Variação acima de +10% →
 * crescente; abaixo de −10% → decrescente; entre os dois → estável. Retorna
 * null com menos de 6 meses na janela ou sem base de comparação. Não é projeção:
 * indica direção recente para leitura do analista.
 */
export function computeTendenciaRenda(
  income: {
    months?: Array<Record<string, unknown>>;
    fromYearMonth?: string;
    toYearMonth?: string;
  } | null | undefined,
): TendenciaRendaResult {
  const rows = (income?.months || [])
    .map((mo) => ({ idx: ymIndex(mo.yearMonth), val: num(mo.validatedIncome) }))
    .filter((r): r is { idx: number; val: number } => r.idx != null);
  if (rows.length === 0) return { tendencia: null, variacao: null };

  const minIdx = Math.min(...rows.map((r) => r.idx));
  const maxIdx = Math.max(...rows.map((r) => r.idx));
  const start = ymIndex(income?.fromYearMonth) ?? minIdx;
  const endRaw = ymIndex(income?.toYearMonth) ?? maxIdx;
  const end = isMesCorrente(income?.toYearMonth) ? endRaw - 1 : endRaw;
  if (end < start) return { tendencia: null, variacao: null };

  const serie = new Array<number>(end - start + 1).fill(0);
  rows.forEach((r) => {
    if (r.idx >= start && r.idx <= end) serie[r.idx - start] += r.val;
  });
  if (serie.length < 6) return { tendencia: null, variacao: null };

  const avg = (values: number[]) => values.reduce((a, v) => a + v, 0) / values.length;
  const recente = avg(serie.slice(-3));
  const anterior = avg(serie.slice(-6, -3));

  if (anterior <= 0) {
    return recente > 0
      ? { tendencia: 'crescente', variacao: null }
      : { tendencia: null, variacao: null };
  }

  const variacao = recente / anterior - 1;
  const tendencia: TendenciaRenda = variacao > 0.1 ? 'crescente' : variacao < -0.1 ? 'decrescente' : 'estavel';
  return { tendencia, variacao };
}

export type PerfilRenda = 'folha' | 'recorrente-pj' | 'variavel' | 'indeterminado';

export interface PerfilRendaResult {
  perfil: PerfilRenda;
  label: string;
  descricao: string;
}

const PERFIL_RENDA_VIEW: Record<PerfilRenda, Omit<PerfilRendaResult, 'perfil'>> = {
  folha: {
    label: 'Folha de pagamento',
    descricao: 'Créditos recorrentes com indício de salário/folha — vínculo CLT provável.',
  },
  'recorrente-pj': {
    label: 'Recorrente PJ',
    descricao: 'Pagador recorrente pessoa jurídica sem indício de folha — prestação de serviço provável.',
  },
  variavel: {
    label: 'Variável',
    descricao: 'Renda recorrente apenas de pessoas físicas/PIX — renda variável ou informal provável.',
  },
  indeterminado: {
    label: 'Indeterminado',
    descricao: 'Sem renda recorrente classificada no período.',
  },
};

const FOLHA_KEYWORDS = /\b(SALARIO|FOLHA|PROVENTO|PROVENTOS|REMUNERACAO|HOLERITE|PORTABILIDADE)\b/;

function normalizeDescription(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Classifica o perfil da renda verificada a partir dos créditos que o backend
 * marcou como recorrentes (`isRecurringLine`): 'folha' quando alguma descrição
 * indica salário/folha; 'recorrente-pj' quando há pagador recorrente pessoa
 * jurídica sem indício de folha; 'variavel' quando a renda recorrente vem só de
 * pessoas físicas/PIX; 'indeterminado' sem renda recorrente. Heurística de
 * apresentação para orientar o analista — não substitui verificação documental
 * de vínculo empregatício.
 */
export function classifyPerfilRenda(
  lines: Array<Record<string, unknown>> | null | undefined,
): PerfilRendaResult {
  const recorrentes = (lines || []).filter((l) => num(l.amount) > 0 && isRecurringLine(l));

  let perfil: PerfilRenda;
  if (recorrentes.length === 0) {
    perfil = 'indeterminado';
  } else if (recorrentes.some((l) => FOLHA_KEYWORDS.test(normalizeDescription(l.description)))) {
    perfil = 'folha';
  } else if (recorrentes.some((l) => String(l.personType || '').toUpperCase().includes('JURIDICA'))) {
    perfil = 'recorrente-pj';
  } else {
    perfil = 'variavel';
  }

  return { perfil, ...PERFIL_RENDA_VIEW[perfil] };
}

/**
 * Janela de exibição do extrato: os 12 meses completos anteriores mais o mês
 * corrente (parcial). A análise de renda permanece em meses completos; o mês
 * em curso entra apenas na exibição/exportação do extrato.
 */
export function statementWindow(now: Date = new Date()): { from: string; to: string } {
  const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
  const from = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  return { from: ym(from.getFullYear(), from.getMonth()), to: ym(now.getFullYear(), now.getMonth()) };
}

/** Indica se um yearMonth (YYYY-MM) é o mês corrente — usado para rotular o período parcial. */
export function isMesCorrente(ym: unknown, now: Date = new Date()): boolean {
  return String(ym ?? '') === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
