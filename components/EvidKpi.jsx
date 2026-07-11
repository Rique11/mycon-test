// EvidKpi.jsx — card compacto de indicador (label + tooltip, valor em destaque e
// legenda), usado para exibir evidências de renda em telas de cliente e no
// drawer de casos da POC.

import React from 'react';
import { TOKENS } from '../tokens.js';
import InfoTip from './InfoTip.jsx';

export default function EvidKpi({ label, value, sub, tone, mono = false, info }) {
  const colorMap = { success: TOKENS.success, warning: TOKENS.warning, danger: TOKENS.danger };
  const color = colorMap[tone] ?? TOKENS.text;
  return (
    <div style={{
      padding: '12px 14px', background: TOKENS.panel,
      border: `1px solid ${TOKENS.border}`, borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </div>
        <InfoTip text={info} />
      </div>
      <div className={mono ? 'num' : ''} style={{ fontSize: 18, fontWeight: 700, color, letterSpacing: -0.3 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: TOKENS.textSubtle, marginTop: 3 }}>{sub}</div>
    </div>
  );
}
