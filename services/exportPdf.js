/**
 * exportPdf.js — geração do extrato Open Finance 12m em PDF via janela de
 * impressão do navegador, no formato de 5 colunas (Data Lançamento, Histórico,
 * Descrição, Valor, Saldo). Quando o cliente tem mais de uma instituição
 * conectada, o documento traz uma seção de extrato por instituição, cada uma
 * com saldo corrente independente. Todo dado externo (nome, histórico,
 * descrição) é escapado antes de entrar no HTML; a janela abre a partir de um
 * Blob URL com noopener, sem acesso à origem da aplicação.
 */

import { escapeHtml, maskCpf, periodo, slug } from '../lib/format';
import { buildExtratoLines, groupStatementByInstitution } from './extratoFormat.js';

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

export function exportExtratoPdf(client, statement) {
  const groups = groupStatementByInstitution(statement);
  const title = `Extrato Open Finance 12m - ${client?.name || 'Cliente'}`;
  const sections = groups.map(({ label, statement: groupStatement }) => `
    ${label ? `<h2>${escapeHtml(label)}</h2>` : ''}
    ${extratoTableHtml(groupStatement)}
  `).join('');

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          body { font-family: Inter, Arial, sans-serif; color: #101A33; margin: 0; }
          h1 { font-size: 20px; margin: 0 0 6px; }
          h2 { font-size: 14px; margin: 18px 0 8px; page-break-after: avoid; }
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
          CPF: ${escapeHtml(client?.cpf ? maskCpf(client.cpf) : '—')} · Período: ${escapeHtml(periodo(statement))} · Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}
        </div>
        ${sections}
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, '_blank', 'noopener');

  if (!popup) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-${slug(client?.name)}-${statement?.toYearMonth || ''}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
