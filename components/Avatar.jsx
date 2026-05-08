const TONE_BG = {
  blue:    '#DBEAFE',
  success: '#DCFCE7',
  warning: '#FEF3C7',
  danger:  '#FEE2E2',
  purple:  '#EDE9FE',
  gray:    '#F3F4F6',
};
const TONE_FG = {
  blue:    '#1D4ED8',
  success: '#15803D',
  warning: '#B45309',
  danger:  '#B91C1C',
  purple:  '#6D28D9',
  gray:    '#374151',
};

function initials(name) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Avatar({ name, size = 36, tone = 'blue' }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: TONE_BG[tone] ?? TONE_BG.gray,
      color: TONE_FG[tone] ?? TONE_FG.gray,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.36,
      fontWeight: 700,
      flexShrink: 0,
      letterSpacing: -0.5,
      userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  );
}
