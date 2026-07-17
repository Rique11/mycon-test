// exportExcel.js — geração de planilhas Excel (ExcelJS) a partir dos dados
// Open Finance e do caso de contemplação: o extrato normalizado e o dossiê
// consolidado (Resumo, Raio-X, Composição Mensal, Lançamentos, uma aba de
// Extrato por instituição financeira conectada (12 meses completos + mês corrente parcial) e Auditoria), seguindo o
// Guia Funcional. O arquivo não contém recomendação/decisão. Estilo visual
// replicado do Excel de referência
// (mycon-poc-excel-consolidado-V1-visual-padronizado.xlsx).

import { maskCpf as maskCpfShared, mesLabel, periodo, slug } from '../lib/format';
import { PRODUCT_LABELS, isMesCorrente, receiptMethod } from './domain';
import { buildExtratoLines, groupStatementByInstitution } from './extratoFormat.js';

async function loadExcelJS() {
  const mod = await import('exceljs');
  return mod.default ?? mod;
}


const GROUP_LABEL = {
  receita: 'Receita',
  ent: 'Entre contas (Pessoa Física)',
};

function groupLabel(classification) {
  return classification === 'ENT' ? GROUP_LABEL.ent : GROUP_LABEL.receita;
}

const NO_DATA_NOTE = 'Nenhum dado de Open Finance disponível para este caso nesta janela.';

const FONT = 'Arial';

const COLOR = {
  titleBg: 'FF102A43',
  titleFont: 'FFFFFFFF',
  sectionBg: 'FF1F4E79',
  colHeaderBg: 'FF334155',
  totalBg: 'FFEAF2F8',
  totalLabel: 'FF102A43',
  body: 'FF1F2937',
  zebraEven: 'FFFCFDFF',
  subtitle: 'FF64748B',
  borderLight: 'FFEEF2F7',
  borderMed: 'FFD7DEE8',
  alertBg: 'FFB91C1C',
  alertFont: 'FFFFFFFF',
  good: 'FF166534',
  warn: 'FFA16207',
  bad: 'FFB91C1C',
};

const FMT = {
  cur0: '"R$" #,##0',
  cur2: '"R$"#,##0.00',
  curSigned: '+"R$" #,##0;-"R$" #,##0;"R$" 0',
  curSignedCond: '[Green]+"R$" #,##0;[Red]-"R$" #,##0;"R$" 0',
  pct1: '0.0%',
  date: 'dd/mm/yyyy',
  dateTime: 'dd/mm/yyyy hh:mm',
};

// ── Helpers de dado ──────────────────────────────────────────────────────────

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function sum(values) {
  return values.reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function avg(values) {
  return values.length ? sum(values) / values.length : 0;
}

// Datas do Open Finance chegam como 'YYYY-MM-DD'; construir em UTC preserva o
// dia exibido no Excel independentemente do fuso horário de quem abrir o arquivo.
function toExcelDate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function toExcelDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function maskCpf(cpf) {
  if (!cpf) return '—';
  return maskCpfShared(cpf) || '—';
}

function formatConfidence(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['alta', 'high'].includes(normalized)) return { value, color: COLOR.good };
    if (['media', 'média', 'medium'].includes(normalized)) return { value, color: COLOR.warn };
    if (['baixa', 'low'].includes(normalized)) return { value, color: COLOR.bad };
    return { value, color: null };
  }
  if (typeof value === 'number') return { value, color: null };
  return { value: value || '', color: null };
}

// ── Helpers de estilo (paleta/tipografia da referência visual-padronizado) ──

function border(cell, color = COLOR.borderLight) {
  const side = { style: 'thin', color: { argb: color } };
  cell.border = { top: side, left: side, bottom: side, right: side };
}

function styleRange(ws, row, colStart, colEnd, { font, fill, alignment, borderColor } = {}) {
  for (let col = colStart; col <= colEnd; col += 1) {
    const cell = ws.getCell(row, col);
    if (font) cell.font = font;
    if (fill) cell.fill = fill;
    if (alignment) cell.alignment = alignment;
    if (borderColor) border(cell, borderColor);
  }
}

function noGrid(ws) {
  ws.views = [{ showGridLines: false }];
}

function titleRow(ws, row, span, text, combinedSubtitle) {
  ws.mergeCells(row, 1, row, span);
  const cell = ws.getCell(row, 1);
  if (combinedSubtitle) {
    cell.value = {
      richText: [
        { font: { name: FONT, size: 16, bold: true, color: { argb: COLOR.titleFont } }, text: `${text}\n` },
        { font: { name: FONT, size: 9, italic: true, color: { argb: COLOR.titleFont } }, text: combinedSubtitle },
      ],
    };
    ws.getRow(row).height = 43.5;
  } else {
    cell.value = text;
    cell.font = { name: FONT, size: 15, bold: true, color: { argb: COLOR.titleFont } };
    ws.getRow(row).height = 19.95;
  }
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  styleRange(ws, row, 1, span, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } }, borderColor: COLOR.titleBg });
}

function subtitleRow(ws, row, span, text) {
  ws.mergeCells(row, 1, row, span);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: FONT, size: 9, italic: true, color: { argb: COLOR.subtitle } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  ws.getRow(row).height = 14.4;
}

function sectionHeader(ws, row, span, text) {
  ws.mergeCells(row, 1, row, span);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  styleRange(ws, row, 1, span, {
    font: { name: FONT, size: 11, bold: true, color: { argb: COLOR.titleFont } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.sectionBg } },
    borderColor: COLOR.sectionBg,
  });
  ws.getRow(row).height = 19.95;
}

function alertBanner(ws, row, span, text) {
  ws.mergeCells(row, 1, row, span);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  styleRange(ws, row, 1, span, {
    font: { name: FONT, size: 10, bold: true, color: { argb: COLOR.alertFont } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.alertBg } },
    borderColor: COLOR.alertBg,
  });
  ws.getRow(row).height = 24;
}

function noteRow(ws, row, span, text, height = 24) {
  ws.mergeCells(row, 1, row, span);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: FONT, size: 9, italic: true, color: { argb: COLOR.subtitle } };
  cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  ws.getRow(row).height = height;
}

function columnHeaderRow(ws, row, headers) {
  headers.forEach((text, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = text;
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLOR.titleFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.colHeaderBg } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    border(cell, COLOR.borderMed);
  });
  ws.getRow(row).height = 26.4;
}

function dataRow(ws, row, values, { zebra, formats } = {}) {
  values.forEach((value, i) => {
    const cell = ws.getCell(row, i + 1);
    if (value !== '' && value !== null && value !== undefined) cell.value = value;
    cell.font = { name: FONT, size: 10, color: { argb: COLOR.body } };
    if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebraEven } };
    if (formats?.[i]) cell.numFmt = formats[i];
    border(cell);
  });
}

function totalRow(ws, row, values, { formats } = {}) {
  values.forEach((value, i) => {
    const cell = ws.getCell(row, i + 1);
    if (value !== '' && value !== null && value !== undefined) cell.value = value;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: i === 0 ? COLOR.totalLabel : COLOR.body } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.totalBg } };
    if (formats?.[i]) cell.numFmt = formats[i];
    border(cell, COLOR.borderMed);
  });
}

function identRow(ws, row, pairs) {
  pairs.forEach(([label, value], idx) => {
    const col = idx * 2 + 1;
    const labelCell = ws.getCell(row, col);
    labelCell.value = label;
    labelCell.font = { name: FONT, size: 9, bold: true, color: { argb: COLOR.body } };
    border(labelCell);
    const valueCell = ws.getCell(row, col + 1);
    valueCell.value = value === null || value === undefined || value === '' ? '—' : value;
    valueCell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.body } };
    border(valueCell);
  });
}

function auditRow(ws, row, label, value, fmt, zebra) {
  const labelCell = ws.getCell(row, 1);
  labelCell.value = label;
  labelCell.font = { name: FONT, size: 11, bold: true, color: { argb: COLOR.body } };
  border(labelCell);
  const valueCell = ws.getCell(row, 2);
  valueCell.value = value === null || value === undefined || value === '' ? '—' : value;
  valueCell.font = { name: FONT, size: 11, color: { argb: COLOR.body } };
  valueCell.alignment = { wrapText: true, vertical: 'top' };
  if (fmt && value) valueCell.numFmt = fmt;
  border(valueCell);
  if (zebra) {
    const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebraEven } };
    labelCell.fill = fill;
    valueCell.fill = fill;
  }
}

function kpiCard(ws, row, colStart, { label, value, fmt, subtext }) {
  const colEnd = colStart + 1;
  const cardFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebraEven } };
  const centered = { horizontal: 'center', vertical: 'center', wrapText: true };

  ws.mergeCells(row, colStart, row, colEnd);
  ws.getCell(row, colStart).value = label;
  styleRange(ws, row, colStart, colEnd, {
    font: { name: FONT, size: 8, bold: true, color: { argb: COLOR.body } },
    fill: cardFill,
    alignment: centered,
    borderColor: COLOR.borderMed,
  });

  ws.mergeCells(row + 1, colStart, row + 1, colEnd);
  const valueCell = ws.getCell(row + 1, colStart);
  valueCell.value = value === null || value === undefined ? '—' : value;
  if (fmt && value !== null && value !== undefined) valueCell.numFmt = fmt;
  styleRange(ws, row + 1, colStart, colEnd, {
    font: { name: FONT, size: 18, bold: true, color: { argb: COLOR.body } },
    alignment: { horizontal: 'center', vertical: 'center' },
    borderColor: COLOR.borderMed,
  });
  ws.getRow(row + 1).height = 30;

  ws.mergeCells(row + 2, colStart, row + 2, colEnd);
  ws.getCell(row + 2, colStart).value = subtext;
  styleRange(ws, row + 2, colStart, colEnd, {
    font: { name: FONT, size: 8, color: { argb: COLOR.body } },
    fill: cardFill,
    alignment: centered,
    borderColor: COLOR.borderMed,
  });
}

async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Helpers de valor textual (bloco de leitura V0) ───────────────────────────

function moneyStr(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `R$ ${Math.round(Number(value)).toLocaleString('pt-BR')}`;
}

function pctStr(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${(Number(value) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function dateTimeStr(value) {
  if (!value) return 'Não informado';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Não informado' : d.toLocaleString('pt-BR');
}

// Cabeçalho da tabela Parâmetro | Valor | Leitura / regra (regra mesclada 3–6).
function paramTableHeader(ws, row) {
  [[1, 'Parâmetro'], [2, 'Valor']].forEach(([col, text]) => {
    const cell = ws.getCell(row, col);
    cell.value = text;
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLOR.titleFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.colHeaderBg } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    border(cell, COLOR.borderMed);
  });
  ws.mergeCells(row, 3, row, 6);
  const rule = ws.getCell(row, 3);
  rule.value = 'Leitura / regra';
  rule.font = { name: FONT, size: 9, bold: true, color: { argb: COLOR.titleFont } };
  rule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.colHeaderBg } };
  rule.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  for (let col = 4; col <= 6; col += 1) border(ws.getCell(row, col), COLOR.borderMed);
  ws.getRow(row).height = 18;
}

function paramRow(ws, row, param, valor, rule, zebra) {
  const pc = ws.getCell(row, 1);
  pc.value = param;
  pc.font = { name: FONT, size: 9, bold: true, color: { argb: COLOR.body } };
  pc.alignment = { vertical: 'top', wrapText: true };
  border(pc);
  const vc = ws.getCell(row, 2);
  vc.value = valor;
  vc.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.body } };
  vc.alignment = { vertical: 'top', wrapText: true };
  border(vc);
  ws.mergeCells(row, 3, row, 6);
  const rc = ws.getCell(row, 3);
  rc.value = rule;
  rc.font = { name: FONT, size: 9, color: { argb: COLOR.subtitle } };
  rc.alignment = { vertical: 'top', wrapText: true };
  border(rc);
  for (let col = 4; col <= 6; col += 1) border(ws.getCell(row, col));
  if (zebra) {
    const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebraEven } };
    for (let col = 1; col <= 6; col += 1) ws.getCell(row, col).fill = fill;
  }
  ws.getRow(row).height = Math.max(24, Math.ceil(String(rule).length / 68) * 13.5);
}

// Bloco de leitura V0: capacidade, comprometimento, reserva, estabilidade,
// confiança e memória de cálculo. Valores derivados de insights/income/extrato/
// caso Mycon; quando a fonte não existe, a célula explicita a pendência em vez
// de assumir zero. Retorna a próxima linha livre.
function appendResumoV0(ws, startRow, { client, caseItem, insights, income, statement }) {
  let r = startRow;

  const incomeMonths = income?.months || [];
  const mesesRecebidos = income?.summary?.monthsAnalyzed || incomeMonths.length;

  const receitas = incomeMonths.map((m) => Math.max(0, (num(m.totalCredits) ?? 0) - (num(m.betweenAccounts) ?? 0)));
  const receitasPos = receitas.filter((v) => v > 0);
  const receitaMedia = receitasPos.length ? avg(receitasPos) : null;

  const validadas = incomeMonths.map((m) => num(m.validatedIncome)).filter((v) => v != null && v > 0);
  const rendaValidada = validadas.length ? avg(validadas) : null;
  const mesesRendaValida = validadas.length;

  // Renda verificada = mediana mensal recorrente calculada pelo backend
  // (summary.validatedIncomeAvg), alinhada à aba de Auditoria e à tela de análise.
  const rendaVerificadaMediana = num(income?.summary?.validatedIncomeAvg);
  const renda = [rendaVerificadaMediana, rendaValidada, num(insights?.avgMonthlyIncome12m), receitaMedia]
    .find((v) => v != null && Number.isFinite(v) && v > 0) ?? 0;
  const gasto = num(insights?.avgMonthlySpend3m) ?? 0;

  const parcela = num(caseItem?.installment ?? caseItem?.parcela ?? caseItem?.monthlyPayment);
  const parcelaPendente = parcela == null;

  const stmtRows = statement?.rows || [];
  const flowByMonth = new Map();
  let entradas12m = 0;
  let saidas12m = 0;
  stmtRows.forEach((row) => {
    const inf = num(row.inflow) ?? 0;
    const out = num(row.outflow) ?? 0;
    entradas12m += inf;
    saidas12m += out;
    const ym = row.yearMonth || String(row.date || '').slice(0, 7);
    const acc = flowByMonth.get(ym) || { inf: 0, out: 0 };
    acc.inf += inf;
    acc.out += out;
    flowByMonth.set(ym, acc);
  });
  const mesesFluxo = flowByMonth.size;
  const fluxoMedio = mesesFluxo ? (entradas12m - saidas12m) / mesesFluxo : null;
  const mesesFluxoNeg = [...flowByMonth.values()].filter((v) => v.inf - v.out < 0).length;

  let cv = null;
  if (receitasPos.length >= 3) {
    const media = avg(receitasPos);
    const variancia = avg(receitasPos.map((v) => (v - media) ** 2));
    cv = media > 0 ? Math.sqrt(variancia) / media : null;
  }

  const folga = parcelaPendente ? null : renda - gasto - parcela;
  const comprometimento = renda > 0 ? gasto / renda : null;

  const sections = [
    ['CAPACIDADE & FLUXO DE CAIXA', [
      ['Renda recorrente verificada', moneyStr(renda),
        `Renda verificada = mediana mensal dos créditos de pagadores recorrentes (≥4 meses), excluindo transferências entre contas e atípicos. Base OF, ${mesesRecebidos} meses.`],
      ['(-) Gasto observado', moneyStr(gasto),
        'Usa despesa média mensal 3m retornada pelo backend.'],
      ['(-) Parcela do consórcio', parcelaPendente ? 'Pendente fonte Mycon' : moneyStr(parcela),
        'A parcela não chegou em `caseItem`; o Excel não estima esse valor a partir do Open Finance.'],
      ['(=) Folga sobre renda', parcelaPendente ? 'Pendente parcela' : moneyStr(folga),
        'Depende de renda, gasto e parcela Mycon. Sem parcela, a V0 explicita pendência em vez de usar zero.'],
      ['Fluxo líquido real da conta', fluxoMedio == null ? '—' : moneyStr(fluxoMedio),
        `Média mensal de entradas menos saídas. Total 12m: entradas ${moneyStr(entradas12m)}, saídas ${moneyStr(saidas12m)}.`],
      ['Origem da folga', 'Sem alerta V0',
        'Folga operacional depende da parcela Mycon, que ainda não chegou ao exportador.'],
    ]],
    ['COMPROMETIMENTO & DÍVIDAS', [
      ['Parcela / renda verificada', parcelaPendente ? 'Pendente parcela' : (renda > 0 ? pctStr(parcela / renda) : 'NaN'),
        'Não calculado porque a parcela mensal não chegou ao exportador.'],
      ['Débito/Renda', insights?.debtToIncomeRatio != null ? pctStr(insights.debtToIncomeRatio) : '—',
        'Indicador agregado recebido em `insights.debtToIncomeRatio`.'],
      ['Dívida total (empréstimos)', moneyStr(num(insights?.totalLiabilities) ?? 0),
        'Total agregado de passivos recebido do backend. Contratos detalhados ainda não chegam ao Excel.'],
      ['Fatura de cartão recorrente', 'Pendente payload',
        'A V0 não recebe faturas/cartões detalhados. Não duplica compra de cartão e pagamento de fatura.'],
      ['Comprometimento total / renda', comprometimento == null ? 'NaN' : pctStr(comprometimento),
        'V0 usa gasto observado/renda. Versão posterior deve somar fatura, parcela e parcelas de dívida com fontes dedicadas.'],
    ]],
    ['RESERVA & PATRIMÔNIO', [
      ['Investimentos mapeados via OF', moneyStr(num(insights?.totalAssets) ?? 0),
        'Total agregado recebido em `insights.totalAssets`; detalhe por classe fica para payload dedicado de investimentos.'],
      ['Reserva em conta', 'Indisponível na fonte atual',
        'O exportador atual não recebe saldo atual/médio por conta. Não apresentar saldo médio sem histórico real.'],
      ['Fôlego da conta', 'Indisponível na fonte atual',
        'Depende de saldo atual ou saldo médio confiável. A V0 evita inferência sem fonte.'],
      ['Cobertura investida (parcelas)', 'Pendente parcela',
        'Depende de patrimônio investido e parcela mensal do caso.'],
    ]],
    ['ESTABILIDADE', [
      ['Volatilidade da renda (CV)', cv == null ? '—' : pctStr(cv),
        cv == null
          ? 'Meses insuficientes para calcular volatilidade com segurança.'
          : 'Coeficiente de variação da receita mensal (desvio-padrão ÷ média) nos meses com receita.'],
      ['Meses com fluxo negativo', mesesFluxo ? String(mesesFluxoNeg) : 'Indisponível',
        'Conta meses em que entradas menos saídas ficou abaixo de zero.'],
      ['Meses com renda válida', incomeMonths.length ? String(mesesRendaValida) : 'Indisponível',
        'Quantidade de meses com renda validada maior que zero no payload de composição.'],
      ['Dias com saldo negativo', 'Indisponível na fonte atual',
        'O JSON analisado não traz série diária de saldo; não simular esse indicador.'],
      ['Saldo mínimo no período', 'Indisponível na fonte atual',
        'Depende de histórico de saldo. A V0 explicita a limitação.'],
    ]],
    ['CONFIANÇA DO DADO & FONTES', [
      ['Open Finance', client?.akropoliLinkId ? 'Conectado' : 'Não informado',
        'Status operacional baseado no vínculo Akropoli do cliente recebido pelo front.'],
      ['Período analisado', periodo(income),
        `Meses efetivamente cobertos: ${mesesRecebidos}.`],
      ['Último sync', dateTimeStr(insights?.lastSyncAt),
        'Data informada pelo backend em `insights.lastSyncAt`, quando disponível.'],
      ['Consentimento formal', 'Não detalhado neste payload',
        'Não inferir permissões, validade ou escopo do consentimento apenas a partir do status de recurso.'],
    ]],
    ['MEMÓRIA DE CÁLCULO - V0', [
      ['Renda', 'Calculada',
        'Prioriza a mediana mensal recorrente (renda verificada) do backend; na ausência, usa renda validada mensal, renda 12m do insight ou receita OF sem transferências entre contas.'],
      ['Gasto e fluxo', 'Calculado',
        'Gasto usa insight 3m ou saídas do extrato. Fluxo usa entradas menos saídas por mês em `statement.rows`.'],
      ['Parcela e comprometimento', 'Parcial',
        'Parcela depende do caso Mycon. Se ausente, o dossiê mostra pendência e não trata como zero.'],
      ['Limitações assumidas', 'Explícitas',
        'Saldo médio, saldo mínimo, dias negativos, cartão detalhado, loans detalhado e consentimento formal ficam pendentes de payload/fonte.'],
    ]],
  ];

  sections.forEach(([title, rows]) => {
    sectionHeader(ws, r, 6, title);
    r += 1;
    paramTableHeader(ws, r);
    r += 1;
    rows.forEach((cols, idx) => {
      paramRow(ws, r, cols[0], cols[1], cols[2], idx % 2 === 1);
      r += 1;
    });
    r += 1;
  });

  return r;
}

// ── Construtores de aba ──────────────────────────────────────────────────────

function buildResumoSheet(ws, { client, caseItem, insights, income, statement, dataStatus }) {
  noGrid(ws);
  ws.columns = [26, 14, 24, 15, 20, 15].map((width) => ({ width }));

  titleRow(ws, 1, 6, 'Dossiê Consolidado — Evidências Open Finance (POC Mycon)');
  subtitleRow(ws, 2, 6, 'Leitura de fluxo de caixa e dados do caso de contemplação. Sem recomendação ou decisão de crédito.');
  let r = 4;

  if (dataStatus !== 'real') {
    alertBanner(ws, r, 6, dataStatus === 'demo'
      ? 'AVISO: cliente não localizado na base de Clientes. Os dados abaixo são demonstrativos e não representam Open Finance real do titular.'
      : 'AVISO: cliente localizado, mas sem dados de Open Finance coletados até o momento. Indicadores abaixo estão vazios.');
    r += 2;
  } else {
    r += 1;
  }

  sectionHeader(ws, r, 6, 'IDENTIFICAÇÃO DO CASO (CONSÓRCIO)');
  r += 1;
  identRow(ws, r, [
    ['Grupo', caseItem?.group || '—'],
    ['Cota', caseItem?.quota || '—'],
    ['Produto', PRODUCT_LABELS[caseItem?.product] || caseItem?.product || '—'],
  ]);
  r += 1;
  identRow(ws, r, [
    ['Valor da carta', caseItem?.letterValue || '—'],
    ['Data de contemplação', toExcelDate(caseItem?.contemplationDate) ?? '—'],
    ['ID do caso', caseItem?.externalCaseId || '—'],
  ]);
  if (caseItem?.contemplationDate) ws.getCell(r, 4).numFmt = FMT.date;
  r += 2;

  sectionHeader(ws, r, 6, 'IDENTIFICAÇÃO DO CLIENTE (OPEN FINANCE)');
  r += 1;
  identRow(ws, r, [
    ['Cliente', client?.name || '—'],
    ['CPF', maskCpf(client?.cpf)],
    ['Status', client?.active ? 'Ativo' : 'Inativo'],
  ]);
  r += 1;
  identRow(ws, r, [
    ['Open Finance', client?.akropoliLinkId ? 'Conectado' : '—'],
    ['Período analisado', periodo(income)],
    ['', ''],
  ]);
  r += 2;

  sectionHeader(ws, r, 6, 'INDICADORES (JANELA DE 12 MESES)');
  r += 1;
  const incomeMonths = income?.months || [];
  const mesesRecebidos = income?.summary?.monthsAnalyzed || incomeMonths.length;
  const totalEntradas12m = sum(incomeMonths.map((m) => num(m.totalCredits) ?? 0));
  const rendaVerificadaMediana = num(income?.summary?.validatedIncomeAvg);
  kpiCard(ws, r, 1, {
    label: 'Total de entradas (12m)',
    value: totalEntradas12m,
    fmt: FMT.cur0,
    subtext: 'Soma de todas as entradas dos 12 meses analisados, incluindo transferências entre contas.',
  });
  kpiCard(ws, r, 3, {
    label: 'Renda verificada (mediana)',
    value: rendaVerificadaMediana,
    fmt: FMT.cur0,
    subtext: 'Mediana mensal dos créditos de pagadores recorrentes (≥4 meses), exceto transferências entre contas e atípicos.',
  });
  kpiCard(ws, r, 5, {
    label: 'Despesa média mensal (3m)',
    value: num(insights?.avgMonthlySpend3m),
    fmt: FMT.cur0,
    subtext: 'Saídas médias identificadas no extrato, 3 meses.',
  });
  r += 3;
  kpiCard(ws, r, 1, {
    label: 'Capacidade de poupança (3m)',
    value: num(insights?.savingsCapacity3m),
    fmt: FMT.curSigned,
    subtext: 'Entradas menos saídas médias, 3 meses.',
  });
  kpiCard(ws, r, 3, {
    label: 'Patrimônio investido',
    value: num(insights?.totalAssets),
    fmt: FMT.cur0,
    subtext: 'Saldo de investimentos identificado via Open Finance.',
  });
  kpiCard(ws, r, 5, {
    label: 'Dívida total (empréstimos)',
    value: num(insights?.totalLiabilities),
    fmt: FMT.cur0,
    subtext: 'Saldo devedor de empréstimos identificado via Open Finance.',
  });
  r += 3;

  // debtToIncomeRatio é tratado como fração (0-1) e exibido em percentual — não há
  // confirmação do contrato exato da API para este campo, assumindo padrão de razão.
  identRow(ws, r, [
    ['Renda recorrente detectada', insights?.incomeDetected ? 'Sim' : 'Não'],
    ['Débito/Renda', insights?.debtToIncomeRatio != null ? num(insights.debtToIncomeRatio) : '—'],
    ['', ''],
  ]);
  if (insights?.debtToIncomeRatio != null) ws.getCell(r, 4).numFmt = FMT.pct1;
  r += 2;

  noteRow(ws, r, 6, 'Memória de cálculo: renda verificada = mediana do total mensal de créditos de pagadores recorrentes (presentes em ≥4 meses), excluindo transferências próprias e atípicos. Janela de 12 meses completos quando disponível.', 28);
  r += 2;

  appendResumoV0(ws, r, { client, caseItem, insights, income, statement });
}

function buildRaioXSheet(ws, { income, statement }) {
  noGrid(ws);
  ws.columns = [10, 16, 16, 16].map((width) => ({ width }));
  titleRow(ws, 1, 4, 'Raio-X de Crédito — Fluxo de Caixa mês a mês');
  subtitleRow(ws, 2, 4, 'Entradas, saídas e fluxo líquido por mês, calculados a partir do extrato Open Finance.');

  const saidasPorMes = {};
  (statement?.rows || []).forEach((row) => {
    if (row.outflow != null) {
      saidasPorMes[row.yearMonth] = (saidasPorMes[row.yearMonth] || 0) + (Number(row.outflow) || 0);
    }
  });

  const months = income?.months || [];
  let r = 4;
  if (!months.length) {
    noteRow(ws, r, 4, NO_DATA_NOTE);
    r += 1;
  }
  columnHeaderRow(ws, r, ['Mês', 'Entradas totais', 'Saídas totais', 'Fluxo líquido']);
  r += 1;

  const entradasArr = [];
  const saidasArr = [];
  const fluxoArr = [];
  const flowFormats = [undefined, FMT.cur0, FMT.cur0, FMT.curSignedCond];

  months.forEach((m, idx) => {
    const entradas = num(m.totalCredits) ?? 0;
    const saidas = saidasPorMes[m.yearMonth] || 0;
    const fluxo = entradas - saidas;
    entradasArr.push(entradas);
    saidasArr.push(saidas);
    fluxoArr.push(fluxo);
    dataRow(ws, r, [mesLabel(m.yearMonth), entradas, saidas, fluxo], { zebra: idx % 2 === 1, formats: flowFormats });
    r += 1;
  });

  if (months.length) {
    totalRow(ws, r, ['Total 12m', sum(entradasArr), sum(saidasArr), sum(fluxoArr)], { formats: flowFormats });
    r += 1;
    totalRow(ws, r, ['Média/mês', avg(entradasArr), avg(saidasArr), avg(fluxoArr)], { formats: flowFormats });
    r += 2;
  } else {
    r += 1;
  }

  noteRow(ws, r, 4, 'Observação: saldo de fim de mês não exibido — o Open Finance não fornece saldo histórico por lançamento.');
}

function buildComposicaoSheet(ws, { income }) {
  noGrid(ws);
  ws.columns = [10, 16, 24, 16, 10].map((width) => ({ width }));
  titleRow(ws, 1, 5, 'Composição mensal das entradas', 'Receita e transferências entre contas do titular por mês.');

  const months = income?.months || [];
  let r = 3;
  if (!months.length) {
    noteRow(ws, r, 5, NO_DATA_NOTE);
    r += 1;
  }
  columnHeaderRow(ws, r, ['Mês', 'Receita', 'Entre contas (Pessoa Física)', 'Total entradas', 'Confiança']);
  r += 1;

  const moneyFormats = [undefined, FMT.cur2, FMT.cur2, FMT.cur2, undefined];
  const totals = [0, 0, 0];

  months.forEach((m, idx) => {
    const total = num(m.totalCredits) ?? 0;
    const entreContas = num(m.betweenAccounts) ?? 0;
    const values = [total - entreContas, entreContas, total];
    values.forEach((v, i) => { totals[i] += v; });
    const confidence = formatConfidence(m.confidence);
    dataRow(ws, r, [mesLabel(m.yearMonth), ...values, confidence.value], { zebra: idx % 2 === 1, formats: moneyFormats });
    if (confidence.color) ws.getCell(r, 5).font = { name: FONT, size: 10, bold: true, color: { argb: confidence.color } };
    r += 1;
  });

  if (months.length) {
    totalRow(ws, r, ['Total 12m', ...totals, ''], { formats: moneyFormats });
    r += 1;
  }
}

function buildLancamentosSheet(ws, { income }) {
  noGrid(ws);
  ws.columns = [12, 8, 18, 34, 12, 24, 18].map((width) => ({ width }));
  titleRow(ws, 1, 7, 'Lançamentos classificados', 'Créditos agrupados em receita e transferências entre contas, com método de recebimento.');

  const detail = income?.detail || [];
  let r = 3;
  if (!detail.length) {
    noteRow(ws, r, 7, NO_DATA_NOTE);
    r += 1;
  }
  columnHeaderRow(ws, r, ['Data', 'Mês', 'Origem (tipo pessoa)', 'Histórico', 'Valor', 'Grupo', 'Método de recebimento']);
  r += 1;

  detail.forEach((item, idx) => {
    dataRow(ws, r, [
      toExcelDate(item.date), mesLabel(item.yearMonth), item.personType || '', item.description || '',
      num(item.amount) ?? 0, groupLabel(item.classification), receiptMethod(item.description),
    ], { zebra: idx % 2 === 1, formats: [FMT.date, undefined, undefined, undefined, FMT.cur2, undefined, undefined] });
    r += 1;
  });
}

// Nome de aba válido no Excel: sem os caracteres proibidos (: \ / ? * [ ]),
// com no máximo 31 caracteres e único dentro do workbook (sufixo numérico em
// caso de colisão). O conjunto `used` acumula os nomes já reservados.
function safeSheetName(base, used) {
  const name = String(base || 'Extrato')
    .replace(/[\\/?*:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Extrato';

  let candidate = name;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = `${name.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function buildExtratoSheet(ws, { statement, clientLine, institutionLabel }) {
  noGrid(ws);
  ws.columns = [14, 22, 40, 16, 16].map((width) => ({ width }));
  titleRow(ws, 1, 5, 'Extrato Open Finance 12m', 'Base normalizada: data, histórico, descrição, valor e saldo acumulado.');

  let r = 3;
  if (clientLine) {
    noteRow(ws, r, 5, clientLine, 16);
    r += 1;
  }
  if (institutionLabel) {
    noteRow(ws, r, 5, `Instituição: ${institutionLabel}`, 16);
    r += 1;
  }
  const { lines } = buildExtratoLines(statement);
  if (!lines.length) {
    noteRow(ws, r, 5, NO_DATA_NOTE);
    r += 1;
  }
  columnHeaderRow(ws, r, ['Data Lançamento', 'Histórico', 'Descrição', 'Valor', 'Saldo']);
  r += 1;

  lines.forEach((line, idx) => {
    dataRow(ws, r, [
      toExcelDate(line.date), line.historico, line.descricao,
      num(line.valor) ?? 0, num(line.saldo) ?? 0,
    ], { zebra: idx % 2 === 1, formats: [FMT.date, undefined, undefined, FMT.cur2, FMT.cur2] });
    r += 1;
  });
}

function buildAuditoriaSheet(ws, { client, caseItem, insights, income, dataStatus }) {
  noGrid(ws);
  ws.columns = [28, 48].map((width) => ({ width }));
  titleRow(ws, 1, 2, 'Auditoria e integridade', 'Trilha de rastreabilidade: origem, período, consentimento e geração do arquivo.');

  let r = 3;
  columnHeaderRow(ws, r, ['Campo', 'Valor']);
  r += 1;

  const monthsCovered = income?.months?.length ?? 0;
  const rows = [
    ['Tipo de dossiê', dataStatus === 'real'
      ? 'Real (Open Finance)'
      : dataStatus === 'empty'
        ? 'Real — sem dados Open Finance coletados ainda'
        : 'Demonstrativo — cliente não localizado na base de Clientes'],
    ['Período analisado', periodo(income)],
    ['Meses efetivamente cobertos', monthsCovered ? `${monthsCovered} de 12` : '0 de 12 — sem dados'],
    ['Open Finance', client?.akropoliLinkId ? 'Conectado' : '—'],
    ['Último sync', toExcelDateTime(insights?.lastSyncAt), FMT.dateTime],
    ['Origem dos dados', dataStatus === 'demo' ? 'Dados do caso — dossiê demonstrativo' : 'Open Finance (Akropoli)'],
    ['Gerado em', new Date(), FMT.dateTime],
    ['Observação', 'Renda verificada por mediana mensal recorrente. Saldo histórico por lançamento não disponível via Open Finance.'],
  ];

  rows.forEach(([label, value, fmt], idx) => {
    auditRow(ws, r, label, value, fmt, idx % 2 === 1);
    r += 1;
  });
}

// ── Extrato (tela do cliente) ─────────────────────────────────────────────────

export async function exportExtrato(client, statement) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const groups = groupStatementByInstitution(statement);
  const used = new Set();

  groups.forEach((group) => {
    const base = group.label ? `Extrato_${group.label}` : 'Extrato_12m';
    const ws = workbook.addWorksheet(safeSheetName(base, used));
    buildExtratoSheet(ws, {
      statement: group.statement,
      clientLine: `Cliente: ${client?.name || '—'} · Período: ${periodo(statement)}${isMesCorrente(statement?.toYearMonth) ? ' (mês corrente parcial)' : ''}`,
      institutionLabel: group.label,
    });
  });

  await downloadWorkbook(workbook, `extrato-${slug(client?.name)}-${statement?.toYearMonth || ''}.xlsx`);
}

// ── Dossiê consolidado (botão Exportar Excel) ─────────────────────────────────

export async function buildConsolidadoWorkbook({ client, caseItem, insights, income, statement, dataStatus = 'real' }) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();

  buildResumoSheet(workbook.addWorksheet('01_Resumo'), { client, caseItem, insights, income, statement, dataStatus });
  buildRaioXSheet(workbook.addWorksheet('02_Raio_X_Credito_OF'), { income, statement });
  buildComposicaoSheet(workbook.addWorksheet('03_Composicao_Mensal'), { income });
  buildLancamentosSheet(workbook.addWorksheet('04_Lancamentos'), { income });

  const extratoGroups = groupStatementByInstitution(statement);
  const usedNames = new Set(
    ['01_Resumo', '02_Raio_X_Credito_OF', '03_Composicao_Mensal', '04_Lancamentos', '06_Auditoria_Integridade']
      .map((name) => name.toLowerCase()),
  );
  extratoGroups.forEach((group) => {
    const base = group.label ? `05_Extrato_${group.label}` : '05_Extrato_12m';
    buildExtratoSheet(workbook.addWorksheet(safeSheetName(base, usedNames)), {
      statement: group.statement,
      institutionLabel: group.label,
    });
  });

  buildAuditoriaSheet(workbook.addWorksheet('06_Auditoria_Integridade'), { client, caseItem, insights, income, dataStatus });

  return workbook;
}

export async function exportConsolidado({ client, caseItem, insights, income, statement, dataStatus = 'real' }) {
  const workbook = await buildConsolidadoWorkbook({ client, caseItem, insights, income, statement, dataStatus });
  const suffix = dataStatus === 'demo' ? '-demonstrativo' : '';
  await downloadWorkbook(workbook, `dossie-${slug(client?.name)}-${income?.toYearMonth || ''}${suffix}.xlsx`);
}
