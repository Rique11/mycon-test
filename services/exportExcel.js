// exportExcel.js — geração de planilhas Excel (ExcelJS) a partir dos dados
// Open Finance e do caso de contemplação: o extrato normalizado e o dossiê
// consolidado de 6 abas (Resumo, Raio-X, Composição Mensal, Lançamentos,
// Extrato 12m, Auditoria), seguindo o Guia Funcional. O arquivo não contém
// recomendação/decisão. Estilo visual replicado do Excel de referência
// (mycon-poc-excel-consolidado-V1-visual-padronizado.xlsx).

import ExcelJS from 'exceljs';

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const PRODUCT_LABELS = { imovel: 'Imóvel', veiculo: 'Veículo', servico: 'Serviço' };

const CLASS_LABEL = {
  REC: 'Receita recorrente',
  PIX: 'PIX recorrente',
  ENT: 'Transferência própria',
  NREC: 'Não recorrente',
  ATIP: 'Atípico / excluído',
};

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

function mesLabel(ym) {
  if (!ym) return '';
  const [y, m] = String(ym).split('-').map(Number);
  return `${MES_ABBR[(m || 1) - 1]}/${String(y).slice(-2)}`;
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

function periodo(obj) {
  if (!obj?.fromYearMonth || !obj?.toYearMonth) return '—';
  return `${mesLabel(obj.fromYearMonth)} a ${mesLabel(obj.toYearMonth)}`;
}

function maskCpf(cpf) {
  if (!cpf) return '—';
  const d = String(cpf).replace(/\D/g, '');
  if (d.length < 5) return '***';
  return `***.***.${d.slice(-5, -2)}-${d.slice(-2)}`;
}

function slug(name) {
  return (name || 'cliente').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
  a.click();
  URL.revokeObjectURL(url);
}

// ── Construtores de aba ──────────────────────────────────────────────────────

function buildResumoSheet(ws, { client, caseItem, insights, income, dataStatus }) {
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
  kpiCard(ws, r, 1, {
    label: 'Renda verificada — média (3m)',
    value: num(insights?.avgMonthlyIncome3m),
    fmt: FMT.cur0,
    subtext: 'Mediana mensal de créditos recorrentes, janela de 3 meses.',
  });
  kpiCard(ws, r, 3, {
    label: 'Renda verificada — média (12m)',
    value: num(insights?.avgMonthlyIncome12m),
    fmt: FMT.cur0,
    subtext: 'Mediana mensal de créditos recorrentes, janela de 12 meses.',
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
}

function buildRaioXSheet(ws, { income, statement }) {
  noGrid(ws);
  ws.columns = [10, 16, 16, 16, 16].map((width) => ({ width }));
  titleRow(ws, 1, 5, 'Raio-X de Crédito — Fluxo de Caixa mês a mês');
  subtitleRow(ws, 2, 5, 'Entradas, saídas e fluxo líquido por mês, calculados a partir do extrato Open Finance.');

  const saidasPorMes = {};
  (statement?.rows || []).forEach((row) => {
    if (row.outflow != null) {
      saidasPorMes[row.yearMonth] = (saidasPorMes[row.yearMonth] || 0) + (Number(row.outflow) || 0);
    }
  });

  const months = income?.months || [];
  let r = 4;
  if (!months.length) {
    noteRow(ws, r, 5, NO_DATA_NOTE);
    r += 1;
  }
  columnHeaderRow(ws, r, ['Mês', 'Entradas totais', 'Saídas totais', 'Fluxo líquido', 'Renda validada']);
  r += 1;

  const entradasArr = [];
  const saidasArr = [];
  const fluxoArr = [];
  const rendaArr = [];
  const flowFormats = [undefined, FMT.cur0, FMT.cur0, FMT.curSignedCond, FMT.cur0];

  months.forEach((m, idx) => {
    const entradas = num(m.totalCredits) ?? 0;
    const saidas = saidasPorMes[m.yearMonth] || 0;
    const fluxo = entradas - saidas;
    const renda = num(m.validatedIncome) ?? 0;
    entradasArr.push(entradas);
    saidasArr.push(saidas);
    fluxoArr.push(fluxo);
    rendaArr.push(renda);
    dataRow(ws, r, [mesLabel(m.yearMonth), entradas, saidas, fluxo, renda], { zebra: idx % 2 === 1, formats: flowFormats });
    r += 1;
  });

  if (months.length) {
    totalRow(ws, r, ['Total 12m', sum(entradasArr), sum(saidasArr), sum(fluxoArr), sum(rendaArr)], { formats: flowFormats });
    r += 1;
    totalRow(ws, r, ['Média/mês', avg(entradasArr), avg(saidasArr), avg(fluxoArr), avg(rendaArr)], { formats: flowFormats });
    r += 2;
  } else {
    r += 1;
  }

  noteRow(ws, r, 5, 'Observação: saldo de fim de mês não exibido — o Open Finance não fornece saldo histórico por lançamento.');
}

function buildComposicaoSheet(ws, { income }) {
  noGrid(ws);
  ws.columns = [10, 16, 14, 18, 14, 16, 14, 14, 10].map((width) => ({ width }));
  titleRow(ws, 1, 9, 'Composição mensal da renda verificada', 'Créditos classificados, exclusões e renda validada por mês.');

  const months = income?.months || [];
  let r = 3;
  if (!months.length) {
    noteRow(ws, r, 9, NO_DATA_NOTE);
    r += 1;
  }
  columnHeaderRow(ws, r, ['Mês', 'Receita recorrente', 'PIX recorrente', 'Transferências próprias', 'Não recorrentes', 'Atípicos/excluídos', 'Total entradas', 'Renda validada', 'Confiança']);
  r += 1;

  const moneyFormats = [undefined, FMT.cur2, FMT.cur2, FMT.cur2, FMT.cur2, FMT.cur2, FMT.cur2, FMT.cur2, undefined];
  const totals = [0, 0, 0, 0, 0, 0, 0];

  months.forEach((m, idx) => {
    const values = [
      num(m.recurring) ?? 0, num(m.pixRecurring) ?? 0, num(m.betweenAccounts) ?? 0,
      num(m.nonRecurring) ?? 0, num(m.atypical) ?? 0, num(m.totalCredits) ?? 0, num(m.validatedIncome) ?? 0,
    ];
    values.forEach((v, i) => { totals[i] += v; });
    const confidence = formatConfidence(m.confidence);
    dataRow(ws, r, [mesLabel(m.yearMonth), ...values, confidence.value], { zebra: idx % 2 === 1, formats: moneyFormats });
    if (confidence.color) ws.getCell(r, 9).font = { name: FONT, size: 10, bold: true, color: { argb: confidence.color } };
    r += 1;
  });

  if (months.length) {
    totalRow(ws, r, ['Total 12m', ...totals, ''], { formats: moneyFormats });
    r += 1;
  }
}

function buildLancamentosSheet(ws, { income }) {
  noGrid(ws);
  ws.columns = [12, 8, 18, 34, 12, 20, 18].map((width) => ({ width }));
  titleRow(ws, 1, 7, 'Lançamentos classificados', 'Créditos usados ou excluídos da renda verificada, com rastreabilidade da classificação.');

  const detail = income?.detail || [];
  let r = 3;
  if (!detail.length) {
    noteRow(ws, r, 7, NO_DATA_NOTE);
    r += 1;
  }
  columnHeaderRow(ws, r, ['Data', 'Mês', 'Origem (tipo pessoa)', 'Histórico', 'Valor', 'Classificação', 'Considerado na renda']);
  r += 1;

  detail.forEach((item, idx) => {
    dataRow(ws, r, [
      toExcelDate(item.date), mesLabel(item.yearMonth), item.personType || '', item.description || '',
      num(item.amount) ?? 0, CLASS_LABEL[item.classification] || item.classification || '', item.considered ? 'Sim' : 'Não',
    ], { zebra: idx % 2 === 1, formats: [FMT.date, undefined, undefined, undefined, FMT.cur2, undefined, undefined] });
    r += 1;
  });
}

function buildExtratoSheet(ws, { statement, clientLine }) {
  noGrid(ws);
  ws.columns = [12, 8, 16, 34, 12, 12, 12, 20, 14].map((width) => ({ width }));
  titleRow(ws, 1, 9, 'Extrato Open Finance 12m', 'Base bruta normalizada: data, histórico, entrada, saída.');

  let r = 3;
  if (clientLine) {
    noteRow(ws, r, 9, clientLine, 16);
    r += 1;
  }
  const rows = statement?.rows || [];
  if (!rows.length) {
    noteRow(ws, r, 9, NO_DATA_NOTE);
    r += 1;
  }
  columnHeaderRow(ws, r, ['Data', 'Mês', 'Conta', 'Histórico', 'Tipo', 'Entrada', 'Saída', 'ID transação', 'Origem']);
  r += 1;

  rows.forEach((row, idx) => {
    dataRow(ws, r, [
      toExcelDate(row.date), mesLabel(row.yearMonth), row.account || '', row.history || '', row.type || '',
      row.inflow != null ? num(row.inflow) : null, row.outflow != null ? num(row.outflow) : null,
      row.transactionId || '', row.origin || 'Open Finance',
    ], { zebra: idx % 2 === 1, formats: [FMT.date, undefined, undefined, undefined, undefined, FMT.cur2, FMT.cur2, undefined, undefined] });
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
    ['Cliente (ID)', client?.id || '—'],
    ['Caso (ID externo)', caseItem?.externalCaseId || '—'],
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
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Extrato_12m');
  buildExtratoSheet(ws, { statement, clientLine: `Cliente: ${client?.name || '—'} · Período: ${periodo(statement)}` });
  await downloadWorkbook(workbook, `extrato-${slug(client?.name)}-${statement?.toYearMonth || ''}.xlsx`);
}

export function exportExtratoPdf(client, statement) {
  const rows = statement?.rows || [];
  const title = `Extrato Open Finance 12m - ${client?.name || 'Cliente'}`;
  const money = (value) =>
    value != null ? (num(value) ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
  const htmlRows = rows.map((r) => `
    <tr>
      <td>${r.date ? toExcelDate(r.date)?.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) || '' : ''}</td>
      <td>${mesLabel(r.yearMonth)}</td>
      <td>${r.account || ''}</td>
      <td>${r.history || ''}</td>
      <td>${r.type || ''}</td>
      <td class="num">${money(r.inflow)}</td>
      <td class="num">${money(r.outflow)}</td>
      <td>${r.origin || 'Open Finance'}</td>
    </tr>
  `).join('');

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          body { font-family: Inter, Arial, sans-serif; color: #101A33; margin: 0; }
          h1 { font-size: 20px; margin: 0 0 6px; }
          .meta { font-size: 12px; color: #5F6F89; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { text-align: left; padding: 7px 8px; border-bottom: 1px solid #DDE5F0; color: #5F6F89; text-transform: uppercase; font-size: 9px; }
          td { padding: 7px 8px; border-bottom: 1px solid #E4EAF2; vertical-align: top; }
          .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">
          CPF: ${maskCpf(client?.cpf)} · Período: ${periodo(statement)} · Gerado em ${new Date().toLocaleString('pt-BR')}
        </div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Mês</th>
              <th>Conta</th>
              <th>Histórico</th>
              <th>Tipo</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>${htmlRows || '<tr><td colspan="8">Sem lançamentos disponíveis.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `;

  const popup = window.open('', '_blank');
  if (!popup) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-${slug(client?.name)}-${statement?.toYearMonth || ''}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

// ── Dossiê consolidado (botão Exportar Excel) ─────────────────────────────────

export function buildConsolidadoWorkbook({ client, caseItem, insights, income, statement, dataStatus = 'real' }) {
  const workbook = new ExcelJS.Workbook();

  buildResumoSheet(workbook.addWorksheet('01_Resumo'), { client, caseItem, insights, income, dataStatus });
  buildRaioXSheet(workbook.addWorksheet('02_Raio_X_Credito_OF'), { income, statement });
  buildComposicaoSheet(workbook.addWorksheet('03_Composicao_Mensal'), { income });
  buildLancamentosSheet(workbook.addWorksheet('04_Lancamentos'), { income });
  buildExtratoSheet(workbook.addWorksheet('05_Extrato_12m'), { statement });
  buildAuditoriaSheet(workbook.addWorksheet('06_Auditoria_Integridade'), { client, caseItem, insights, income, dataStatus });

  return workbook;
}

export async function exportConsolidado({ client, caseItem, insights, income, statement, dataStatus = 'real' }) {
  const workbook = buildConsolidadoWorkbook({ client, caseItem, insights, income, statement, dataStatus });
  const suffix = dataStatus === 'demo' ? '-demonstrativo' : '';
  await downloadWorkbook(workbook, `dossie-${slug(client?.name)}-${income?.toYearMonth || ''}${suffix}.xlsx`);
}
