/**
 * extratoFormat.js — normaliza os lançamentos do extrato para o formato
 * canônico de 5 colunas (Data Lançamento, Histórico, Descrição, Valor, Saldo),
 * usado tanto na exportação Excel quanto no PDF. Fonte única de verdade para
 * manter Excel e PDF consistentes.
 *
 * O Open Finance Brasil não expõe nome de contraparte nas transações de conta:
 * o único texto livre é `transactionName` (campo `history` da resposta). Alguns
 * bancos já entregam esse texto como "«rótulo» - «contraparte»" (ex.:
 * "Compra no débito - Uber ..."); nesse caso o rótulo vira Histórico e o
 * restante vira Descrição, sem repetição. Quando não há esse separador, o
 * Histórico é derivado do código `type` (PIX, TED, CARTAO, ...) com o sentido
 * crédito/débito, e a Descrição recebe o texto integral. O "Valor" é único e
 * assinado (crédito positivo, débito negativo) e o "Saldo" é o saldo corrente
 * acumulado em ordem cronológica a partir de um saldo inicial (`openingBalance`
 * do extrato, ou 0 quando ausente), já que o Open Finance não fornece saldo por
 * lançamento.
 */

// Rótulos de Histórico derivados do código `type` do Open Finance Brasil v2.
// Fallback quando o texto do lançamento não traz um rótulo explícito.
const HISTORICO_LABELS = {
  PIX: { credit: 'Pix recebido', debit: 'Pix enviado' },
  TED: { credit: 'TED recebida', debit: 'TED enviada' },
  DOC: { credit: 'DOC recebido', debit: 'DOC enviado' },
  TRANSFERENCIA_MESMA_INSTITUICAO: { credit: 'Transferência recebida', debit: 'Transferência enviada' },
  BOLETO: { credit: 'Boleto recebido', debit: 'Pagamento de boleto' },
  CONVENIO_ARRECADACAO: { credit: 'Convênio recebido', debit: 'Pagamento de convênio' },
  PACOTE_TARIFA_SERVICOS: { credit: 'Estorno de tarifa', debit: 'Tarifa de serviço' },
  TARIFA_SERVICOS_AVULSOS: { credit: 'Estorno de tarifa', debit: 'Tarifa de serviço' },
  FOLHA_PAGAMENTO: { credit: 'Salário', debit: 'Folha de pagamento' },
  DEPOSITO: { credit: 'Depósito', debit: 'Depósito' },
  SAQUE: { credit: 'Saque', debit: 'Saque' },
  CARTAO: { credit: 'Estorno', debit: 'Compra no débito' },
  ENCARGOS_JUROS_CHEQUE_ESPECIAL: { credit: 'Estorno de encargos', debit: 'Encargos e juros' },
  RENDIMENTO_APLIC_FINANCEIRA: { credit: 'Rendimento de aplicação', debit: 'Rendimento de aplicação' },
  RESGATE_APLIC_FINANCEIRA: { credit: 'Resgate de aplicação', debit: 'Aplicação financeira' },
  PORTABILIDADE_SALARIO: { credit: 'Portabilidade de salário', debit: 'Portabilidade de salário' },
  OPERACAO_CREDITO: { credit: 'Operação de crédito', debit: 'Operação de crédito' },
};

// Comprimento máximo aceito para tratar o prefixo (antes do " - ") como rótulo
// de Histórico; evita confundir uma contraparte longa com rótulo.
const MAX_LABEL_LENGTH = 35;

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

// Datas do Open Finance chegam como 'YYYY-MM-DD'; timestamp em UTC evita que o
// fuso horário desloque o dia usado para ordenar cronologicamente.
function dateTimestamp(value) {
  if (!value) return 0;
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Date.UTC(y, m - 1, d);
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Converte um código bruto de `type` sem rótulo mapeado em texto legível
// (ex.: 'OUTROS_CREDITOS' -> 'Outros creditos'), como fallback antes do genérico.
function humanizeType(type) {
  const raw = String(type || '').trim();
  if (!raw) return '';
  const words = raw.replace(/_/g, ' ').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Separa o texto do lançamento em rótulo (Histórico) e contraparte (Descrição)
// quando vem no formato "«rótulo» - «contraparte»". Divide no primeiro " - "
// e só aceita o prefixo como rótulo se ambos os lados existirem e o prefixo for
// curto. Caso contrário, devolve o texto inteiro como descrição, sem rótulo.
function splitTransactionText(text) {
  const raw = String(text || '').trim();
  const sep = raw.indexOf(' - ');
  if (sep > 0) {
    const label = raw.slice(0, sep).trim();
    const rest = raw.slice(sep + 3).trim();
    if (label && rest && label.length <= MAX_LABEL_LENGTH) {
      return { label, rest };
    }
  }
  return { label: '', rest: raw };
}

// Valor único assinado do lançamento: usa um campo já assinado quando existe;
// caso contrário deriva de entrada (crédito) / saída (débito), tratando a saída
// como negativa independentemente de a fonte armazená-la com sinal ou módulo.
export function extratoSignedValue(row) {
  const signed = toNumberOrNull(row?.amount ?? row?.value ?? row?.valor);
  if (signed !== null) return signed;

  const inflow = toNumberOrNull(row?.inflow);
  const outflow = toNumberOrNull(row?.outflow);
  if (inflow !== null && inflow !== 0) return Math.abs(inflow);
  if (outflow !== null && outflow !== 0) return -Math.abs(outflow);
  return 0;
}

// Rótulo de Histórico a partir do código `type` e do sentido do lançamento
// (crédito = entrada, débito = saída). Usado como fallback quando o texto do
// lançamento não traz um rótulo explícito antes do " - ".
export function historicoLabel(type, isCredit) {
  const key = String(type || '').trim().toUpperCase();
  const entry = HISTORICO_LABELS[key];
  if (entry) return isCredit ? entry.credit : entry.debit;
  return humanizeType(type) || (isCredit ? 'Crédito' : 'Débito');
}

// Sentido do lançamento: crédito quando há entrada explícita, débito quando há
// saída explícita, senão pelo sinal do valor (>= 0 tratado como crédito).
function isCreditRow(row) {
  if (toNumberOrNull(row?.inflow) !== null && Number(row.inflow) !== 0) return true;
  if (toNumberOrNull(row?.outflow) !== null && Number(row.outflow) !== 0) return false;
  return extratoSignedValue(row) >= 0;
}

export function extratoOpeningBalance(statement) {
  return (
    toNumberOrNull(
      statement?.openingBalance ??
        statement?.saldoInicial ??
        statement?.saldoAnterior,
    ) ?? 0
  );
}

// Constrói as linhas do extrato no formato canônico. O saldo é acumulado em
// ordem cronológica ascendente (estável por índice de origem para lançamentos
// de mesma data) e associado de volta a cada linha na ordem original recebida.
export function buildExtratoLines(statement) {
  const rows = Array.isArray(statement?.rows) ? statement.rows : [];
  const opening = extratoOpeningBalance(statement);

  const values = rows.map(extratoSignedValue);

  const chronological = rows
    .map((row, index) => ({ index, ts: dateTimestamp(row?.date) }))
    .sort((a, b) => a.ts - b.ts || a.index - b.index);

  const balances = new Array(rows.length);
  let running = opening;
  for (const { index } of chronological) {
    running = round2(running + values[index]);
    balances[index] = running;
  }

  const lines = rows.map((row, index) => {
    const source = firstText(row?.transactionName, row?.history, row?.description);
    const { label, rest } = splitTransactionText(source);
    return {
      date: row?.date ?? null,
      historico: label || historicoLabel(row?.type, isCreditRow(row)),
      descricao: rest,
      valor: round2(values[index]),
      saldo: balances[index],
    };
  });

  return { opening, lines };
}
