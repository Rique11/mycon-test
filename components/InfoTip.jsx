// Ícone "i" com tooltip exibido ao passar o mouse, explicando a métrica do card.

import React from 'react';
import { TOKENS } from '../tokens.js';

export default function InfoTip({ text }) {
  const [show, setShow] = React.useState(false);
  if (!text) return null;
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-flex', marginLeft: 'auto', flexShrink: 0 }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        border: `1px solid ${show ? TOKENS.primary : TOKENS.border}`,
        color: show ? TOKENS.primary : TOKENS.textSubtle,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic',
        cursor: 'help', userSelect: 'none', transition: 'color .12s, border-color .12s',
      }}>i</span>
      {show && (
        <span role="tooltip" style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', right: -4, zIndex: 30,
          width: 210, padding: '8px 10px', background: TOKENS.title, color: '#fff',
          borderRadius: 8, fontSize: 11, lineHeight: 1.45, fontWeight: 400,
          letterSpacing: 0, textTransform: 'none', textAlign: 'left',
          boxShadow: '0 10px 28px rgba(16,26,51,.28)', pointerEvents: 'none',
        }}>{text}</span>
      )}
    </span>
  );
}
