import { TOKENS } from '../tokens.js';

export default function Card({ children, padding = '18px 20px', style = {} }) {
  return (
    <div style={{
      background: TOKENS.surface,
      border: `1px solid ${TOKENS.border}`,
      borderRadius: 12,
      padding,
      ...style,
    }}>
      {children}
    </div>
  );
}
