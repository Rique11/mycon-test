/**
 * exportPdf.js — geração do extrato Open Finance (12 meses completos + mês corrente parcial) em PDF via janela de
 * impressão do navegador, no formato de 5 colunas (Data Lançamento, Histórico,
 * Descrição, Valor, Saldo), com um documento separado por instituição
 * financeira conectada — título, metadados e arquivo próprios, cada um com
 * saldo corrente independente. Com uma única instituição o documento abre
 * direto na janela de impressão; com várias, um arquivo é baixado por
 * instituição e abre a impressão ao ser aberto, já que navegadores bloqueiam
 * múltiplos pop-ups num único clique. Todo dado externo (nome, histórico,
 * descrição) é escapado antes de entrar no HTML; a janela abre a partir de um
 * Blob URL com noopener, sem acesso à origem da aplicação.
 */

import { escapeHtml, maskCpf, periodo, slug } from '../lib/format';
import { buildExtratoLines, groupStatementByInstitution } from './extratoFormat.js';
import { isMesCorrente } from './domain';

function moneyBRL(value) {
  if (value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateBR(value) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function extratoTableHtml(groupStatement) {
  const { lines } = buildExtratoLines(groupStatement);
  const htmlRows = lines.map((line) => `
    <tr>
      <td>${escapeHtml(dateBR(line.date))}</td>
      <td>${escapeHtml(line.historico)}</td>
      <td>${escapeHtml(line.descricao)}</td>
      <td class="num">${escapeHtml(moneyBRL(line.valor))}</td>
      <td class="num">${escapeHtml(moneyBRL(line.saldo))}</td>
    </tr>
  `).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Data Lançamento</th>
          <th>Histórico</th>
          <th>Descrição</th>
          <th class="num">Valor</th>
          <th class="num">Saldo</th>
        </tr>
      </thead>
      <tbody>${htmlRows || '<tr><td colspan="5">Sem lançamentos disponíveis.</td></tr>'}</tbody>
    </table>
  `;
}

function extratoDocumentHtml(client, statement, group) {
  const clientName = client?.name || 'Cliente';
  const title = group.label
    ? `Extrato Open Finance - ${clientName} - ${group.label}`
    : `Extrato Open Finance - ${clientName}`;
  const institutionMeta = group.label ? ` · Instituição: ${escapeHtml(group.label)}` : '';

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
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
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">
          CPF: ${escapeHtml(client?.cpf ? maskCpf(client.cpf) : '—')}${institutionMeta} · Período: ${escapeHtml(periodo(statement))}${isMesCorrente(statement?.toYearMonth) ? ' (mês corrente parcial)' : ''} · Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}
        </div>
        ${extratoTableHtml(group.statement)}
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `;
}

function downloadUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportExtratoPdf(client, statement) {
  const groups = groupStatementByInstitution(statement);
  const period = statement?.toYearMonth || '';
  const urls = [];

  groups.forEach((group) => {
    const html = extratoDocumentHtml(client, statement, group);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    urls.push(url);

    const institutionSlug = group.label ? `-${slug(group.label)}` : '';
    const filename = `extrato-${slug(client?.name)}${institutionSlug}-${period}.html`;

    if (groups.length === 1) {
      const popup = window.open(url, '_blank', 'noopener');
      if (!popup) downloadUrl(url, filename);
    } else {
      downloadUrl(url, filename);
    }
  });

  window.setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 60_000);
}
