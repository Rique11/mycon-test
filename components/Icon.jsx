// Ícone SVG de traço (24x24) usado em toda a interface. Renderiza um ou mais
// paths (string ou array) com stroke ~1.75 no padrão visual da identidade Lizard.

export default function Icon({ d, size = 16, stroke = 'currentColor', strokeWidth = 1.75, fill = 'none' }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
