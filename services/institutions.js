/**
 * institutions.js — helpers puros para identificar instituições financeiras a
 * partir dos campos brutos das evidências Open Finance: detecção de IDs opacos
 * (linkId ULID, hash sha256/512, UUID) que nunca devem ser exibidos como nome
 * de banco, truncamento de tokens para rótulos genéricos e normalização de
 * nomes de instituição para um rótulo canônico legível.
 */

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_TOKEN_RE = /^[0-9a-f]{20,}$/i;

export function isOpaqueToken(value) {
  const raw = String(value || '').trim();
  if (!raw || /\s/.test(raw)) return false;
  if (ULID_RE.test(raw) || UUID_RE.test(raw) || HEX_TOKEN_RE.test(raw)) return true;
  return raw.length >= 20 && /^[0-9A-Za-z]+$/.test(raw);
}

export function truncateToken(value, max = 18) {
  const raw = String(value || '');
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

export function normalizeBankLabel(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/[A-Za-zÀ-ÿ]/.test(raw)) return '';
  if (isOpaqueToken(raw)) return '';
  const lower = raw.toLowerCase();
  if (lower.includes('open finance') || lower.includes('akropoli')) return '';
  if (lower.includes('itau') || lower.includes('itaú')) return 'Itau';
  if (lower.includes('bradesco')) return 'Bradesco';
  if (lower.includes('nubank') || lower.includes('nu ')) return 'Nubank';
  if (lower.includes('santander')) return 'Santander';
  if (lower.includes('caixa')) return 'Caixa';
  if (lower.includes('banco do brasil')) return 'Banco do Brasil';
  if (lower === 'inter' || lower.includes('banco inter')) return 'Inter';
  if (lower.includes('mercado pago')) return 'Mercado Pago';
  return raw.split(/[|/,-]/)[0].trim();
}
