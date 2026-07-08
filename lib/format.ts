/**
 * format.ts — helpers de formatação compartilhados (moeda, data, CPF, meses).
 * Fonte única para os formatadores usados em telas, hooks e serviços de exportação.
 */

export const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function fmtBRL(v: unknown): string {
  const n = num(typeof v === 'string' ? parseFloat(v) : v);
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: unknown): string {
  if (!iso) return '—';
  const date = new Date(String(iso));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function onlyDigits(value: unknown = ''): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function maskCpf(value: unknown = ''): string {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return typeof value === 'string' ? value : '';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

export function ymLabels(ym: unknown): { label: string; long: string } {
  const [y, m] = String(ym).split('-').map(Number);
  const i = Math.min(Math.max((m || 1) - 1, 0), 11);
  return { label: `${MESES_CURTO[i]}/${String(y).slice(-2)}`, long: `${MESES_LONGO[i]}/${y}` };
}

export function mesLabel(ym: unknown): string {
  if (!ym) return '';
  return ymLabels(ym).label;
}

export function periodo(obj: { fromYearMonth?: unknown; toYearMonth?: unknown } | null | undefined): string {
  if (!obj?.fromYearMonth || !obj?.toYearMonth) return '—';
  return `${mesLabel(obj.fromYearMonth)} a ${mesLabel(obj.toYearMonth)}`;
}

export function slug(name: unknown): string {
  return String(name || 'cliente').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
