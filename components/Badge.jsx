import { TOKENS } from '../tokens.js';

const TONE_MAP = {
  blue:    { bg: TOKENS.primarySoft,  fg: TOKENS.primary,  dot: TOKENS.primary },
  success: { bg: TOKENS.successSoft,  fg: TOKENS.success,  dot: TOKENS.success },
  warning: { bg: TOKENS.warningSoft,  fg: TOKENS.warning,  dot: TOKENS.warning },
  danger:  { bg: TOKENS.dangerSoft,   fg: TOKENS.danger,   dot: TOKENS.danger },
  purple:  { bg: TOKENS.purpleSoft,   fg: TOKENS.purple,   dot: TOKENS.purple },
  neutral: { bg: TOKENS.panel,        fg: TOKENS.textMuted, dot: TOKENS.textSubtle },
};

const SIZE_MAP = {
  sm: { fontSize: 11, padding: '2px 7px', gap: 4, dotSize: 5 },
  md: { fontSize: 12.5, padding: '4px 10px', gap: 6, dotSize: 6 },
};

export default function Badge({ tone = 'neutral', size = 'sm', dot = false, children }) {
  const t = TONE_MAP[tone] ?? TONE_MAP.neutral;
  const s = SIZE_MAP[size] ?? SIZE_MAP.sm;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: s.gap,
      background: t.bg,
      color: t.fg,
      fontSize: s.fontSize,
      fontWeight: 600,
      padding: s.padding,
      borderRadius: 100,
      whiteSpace: 'nowrap',
      lineHeight: 1.4,
    }}>
      {dot && (
        <span style={{
          width: s.dotSize,
          height: s.dotSize,
          borderRadius: '50%',
          background: t.dot,
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}
