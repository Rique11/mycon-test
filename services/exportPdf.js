/**
 * exportPdf.js — geração do extrato Open Finance 12m em PDF via janela de
 * impressão do navegador. Todo dado externo (nome, histórico, conta, tipo)
 * é escapado antes de entrar no HTML; a janela abre a partir de um Blob URL
 * com noopener, sem acesso à origem da aplicação.
 */

import { escapeHtml, maskCpf, mesLabel, periodo, slug } from '../lib/format';

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

export function exportExtratoPdf(client, statement) {
  const rows = statement?.rows || [];
  const title = `Extrato Open Finance 12m - ${client?.name || 'Cliente'}`;
  const htmlRows = rows.map((r) => `
    <tr>
      <td>${escapeHtml(dateBR(r.date))}</td>
      <td>${escapeHtml(mesLabel(r.yearMonth))}</td>
      <td>${escapeHtml(r.account || '')}</td>
      <td>${escapeHtml(r.history || '')}</td>
      <td>${escapeHtml(r.type || '')}</td>
      <td class="num">${escapeHtml(moneyBRL(r.inflow))}</td>
      <td class="num">${escapeHtml(moneyBRL(r.outflow))}</td>
      <td>${escapeHtml(r.origin || 'Open Finance')}</td>
    </tr>
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
