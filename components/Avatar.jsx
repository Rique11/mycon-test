// Avatar de iniciais com tons do tema Lizard. O tom 'brand' usa o azul-marinho da
// marca (#102A73) com texto branco, padrão das iniciais na identidade Lizard.

import { TOKENS } from '../tokens.js';

const TONE = {
  brand:   { bg: TOKENS.brand,        fg: '#FFFFFF' },
  blue:    { bg: TOKENS.primarySoft,  fg: TOKENS.primaryFg },
  success: { bg: TOKENS.successSoft,  fg: TOKENS.success },
  warning: { bg: TOKENS.warningSoft,  fg: TOKENS.warningStrong },
  danger:  { bg: TOKENS.dangerSoft,   fg: TOKENS.danger },
  purple:  { bg: TOKENS.purpleSoft,   fg: TOKENS.purple },
  gray:    { bg: TOKENS.panelAlt,     fg: TOKENS.textMuted },
};

function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Avatar({ name, size = 36, tone = 'brand' }) {
  const t = TONE[tone] ?? TONE.gray;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: t.bg,
      color: t.fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.36,
      fontWeight: 600,
      flexShrink: 0,
      l