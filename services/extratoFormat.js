/**
 * extratoFormat.js — normaliza os lançamentos do extrato para o formato
 * canônico de 5 colunas (Data Lançamento, Histórico, Descrição, Valor, Saldo),
 * usado tanto na exportação Excel quanto no PDF. O "Valor" é único e assinado
 * (crédito positivo, débito negativo) e o "Saldo" é o saldo corrente acumulado
 * calculado em ordem cronológica a partir de um saldo inicial (`openingBalance`
 * do extrato, ou 0 quando ausente), já que o Open Finance não fornece saldo por
 * lançamento. Fonte única de verdade para manter Excel e PDF consistentes.
 */

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

  const lines = rows.map((row, index) => ({
    date: row?.date ?? null,
    historico: firstText(row?.history, row?.type),
    descricao: firstText(row?.description, row?.counterparty, row?.merchant, row?.payee),
    valor: round2(values[index]),
    saldo: balances[index],
  }));

  return { opening, lines };
}
