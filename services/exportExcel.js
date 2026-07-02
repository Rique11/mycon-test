// exportExcel.js — geração de planilhas Excel (SheetJS) a partir dos dados
// Open Finance: o extrato normalizado e o dossiê consolidado de 6 abas
// (Resumo, Raio-X, Composição Mensal, Lançamentos, Extrato 12m, Auditoria),
// seguindo o Guia Funcional. O arquivo não contém recomendação/decisão.

import * as XLSX from 'xlsx';

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const CLASS_LABEL = {
  REC: 'Receita recorrente',
  PIX: 'PIX recorrente',
  ENT: 'Transferência própria',
  NREC: 'Não recorrente',
  ATIP: 'Atípico / excluído',
};

function num(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  // Arredonda a 2 casas: valores monetários no Excel sem ruído de mediana (escala 4).
  return Math.round(n * 100) / 100;
}

function mesLabel(ym) {
  if (!ym) return '';
  const [y, m] = String(ym).split('-').map(Number);
  return `${MES_ABBR[(m || 1) - 1]}/${String(y).slice(-2)}`;
}

function fmtData(d) {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return day ? `${day}/${m}/${y}` : String(d);
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

function sheetFromAoa(aoa, cols) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (cols) ws['!cols'] = cols.map((wch) => ({ wch }));
  return ws;
}

function statementAoa(statement) {
  const rows = statement?.rows || [];
  return [
    ['Data', 'Mês', 'Conta', 'Histórico', 'Tipo', 'Entrada', 'Saída', 'ID transação', 'Origem'],
    ...rows.map((r) => [
      fmtData(r.date), mesLabel(r.yearMonth), r.account || '', r.history || '', r.type || '',
      r.inflow != null ? num(r.inflow) : '', r.outflow != null ? num(r.outflow) : '',
      r.transactionId || '', r.origin || 'Open Finance',
    ]),
  ];
}

// ── Extrato (tela do cliente) ───────────────────────────────────────────────

export function exportExtrato(client, statement) {
  const aoa = [
    ['Extrato Open Finance normalizado'],
    [`Cliente: ${client?.name || '—'}`, `Período: ${periodo(statement)}`],
    [],
    ...statementAoa(statement),
  ];
  const ws = sheetFromAoa(aoa, [12, 8, 16, 34, 12, 12, 12, 20, 14]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato_12m');
  XLSX.writeFile(wb, `extrato-${slug(client?.name)}-${statement?.toYearMonth || ''}.xlsx`);
}

export function exportExtratoPdf(client, statement) {
  const rows = statement?.rows || [];
  const title = `Extrato Open Finance 12m - ${client?.name || 'Cliente'}`;
  const money = (value) =>
    value != null ? num(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
  const htmlRows = rows.map((r) => `
    <tr>
      <td>${fmtData(r.date)}</td>
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

// ── Dossiê consolidado (botão Exportar Excel) ───────────────────────────────

export function exportConsolidado({ client, insights, income, statement }) {
  const wb = XLSX.utils.book_new();

  // Saídas mensais (débitos) a partir do extrato, para o Raio-X.
  const saidasPorMes = {};
  (statement?.rows || []).forEach((r) => {
    if (r.outflow != null) {
      saidasPorMes[r.yearMonth] = (saidasPorMes[r.yearMonth] || 0) + num(r.outflow);
    }
  });

  // 01_Resumo
  const resumo = [
    ['Perfil do Cliente — Dossiê de Crédito (leitura por Fluxo de Caixa)'],
    ['POC Mycon · capacidade de pagamento via Open Finance (12m). Números calculados a partir do extrato.'],
    [],
    ['IDENTIFICAÇÃO DO CLIENTE'],
    ['Cliente', client?.name || '—', 'CPF', maskCpf(client?.cpf)],
    ['Status', client?.active ? 'Ativo' : 'Inativo', 'Open Finance', client?.akropoliLinkId ? 'Conectado' : '—'],
    ['Período analisado', periodo(income)],
    [],
    ['INDICADORES (renda verificada por mediana)'],
    ['Renda verificada — mediana semestral (6m)', num(insights?.avgMonthlyIncome3m)],
    ['Renda verificada — mediana anual (12m)', num(insights?.avgMonthlyIncome12m)],
    ['Renda recorrente detectada', insights?.incomeDetected ? 'Sim' : 'Não'],
    ['Despesa média mensal (3m)', num(insights?.avgMonthlySpend3m)],
    ['Capacidade de poupança (3m)', insights?.savingsCapacity3m != null ? num(insights.savingsCapacity3m) : '—'],
    ['Débito/Renda (saldo devedor ÷ renda)', insights?.debtToIncomeRatio != null ? num(insights.debtToIncomeRatio) : '—'],
    ['Patrimônio investido', num(insights?.totalAssets)],
    ['Dívida total (empréstimos)', num(insights?.totalLiabilities)],
    [],
    ['Memória de cálculo: renda verificada = mediana do total mensal de créditos de pagadores recorrentes (presentes em ≥4 meses), excluindo transferências próprias e atípicos. Janela de 12 meses completos.'],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoa(resumo, [40, 18, 14, 18]), '01_Resumo');

  // 02_Raio_X_Credito_OF
  const raiox = [
    ['Raio-X de Crédito — Fluxo de Caixa mês a mês'],
    ['Entradas, saídas e fluxo líquido por mês, calculados a partir do extrato Open Finance.'],
    [],
    ['Mês', 'Entradas totais', 'Saídas totais', 'Fluxo líquido', 'Renda validada'],
    ...(income?.months || []).map((m) => {
      const entradas = num(m.totalCredits);
      const saidas = saidasPorMes[m.yearMonth] || 0;
      return [mesLabel(m.yearMonth), entradas, saidas, entradas - saidas, num(m.validatedIncome)];
    }),
    [],
    ['Observação: saldo de fim de mês não exibido — o Open Finance não fornece saldo histórico por lançamento.'],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoa(raiox, [10, 16, 16, 16, 16]), '02_Raio_X_Credito_OF');

  // 03_Composicao_Mensal
  const comp = [
    ['Composição mensal da renda verificada'],
    ['Créditos classificados, exclusões e renda validada por mês.'],
    [],
    ['Mês', 'Receita recorrente', 'PIX recorrente', 'Transferências próprias', 'Não recorrentes', 'Atípicos/excluídos', 'Total entradas', 'Renda validada', 'Confiança'],
    ...(income?.months || []).map((m) => [
      mesLabel(m.yearMonth), num(m.recurring), num(m.pixRecurring), num(m.betweenAccounts),
      num(m.nonRecurring), num(m.atypical), num(m.totalCredits), num(m.validatedIncome), m.confidence || '',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoa(comp, [10, 16, 14, 18, 14, 16, 14, 14, 10]), '03_Composicao_Mensal');

  // 04_Lancamentos (créditos classificados)
  const lanc = [
    ['Lançamentos classificados — créditos usados ou excluídos da renda verificada'],
    [],
    ['Data', 'Mês', 'Origem (tipo pessoa)', 'Histórico', 'Valor', 'Classificação', 'Considerado na renda'],
    ...(income?.detail || []).map((l) => [
      fmtData(l.date), mesLabel(l.yearMonth), l.personType || '', l.description || '',
      num(l.amount), CLASS_LABEL[l.classification] || l.classification || '', l.considered ? 'Sim' : 'Não',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoa(lanc, [12, 8, 18, 34, 12, 20, 18]), '04_Lancamentos');

  // 05_Extrato_12m
  const extrato = [
    ['Extrato Open Finance 12m'],
    ['Base bruta normalizada: data, histórico, entrada, saída.'],
    [],
    ...statementAoa(statement),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoa(extrato, [12, 8, 16, 34, 12, 12, 12, 20, 14]), '05_Extrato_12m');

  // 06_Auditoria_Integridade
  const aud = [
    ['Auditoria e integridade'],
    [],
    ['Campo', 'Valor'],
    ['Cliente (ID)', client?.id || '—'],
    ['Período analisado', periodo(income)],
    ['Open Finance', client?.akropoliLinkId ? 'Conectado' : '—'],
    ['Último sync', insights?.lastSyncAt ? new Date(insights.lastSyncAt).toLocaleString('pt-BR') : '—'],
    ['Origem dos dados', 'Open Finance (Akropoli)'],
    ['Janela analisada', '12 meses completos'],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Observação', 'Renda verificada por mediana mensal recorrente. Saldo histórico por lançamento não disponível via Open Finance.'],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoa(aud, [24, 48]), '06_Auditoria_Integridade');

  XLSX.writeFile(wb, `dossie-${slug(client?.name)}-${income?.toYearMonth || ''}.xlsx`);
}
