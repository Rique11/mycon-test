// Indicador numérico de etapa: círculo com fundo azul suave e número em
// JetBrains Mono (classe .num), no estilo dos steppers da identidade Lizard.

import { TOKENS } from '../tokens.js';

export default function StepNumber({ n }) {
  return (
    <span className="num" style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: TOKENS.primarySoft,
      color: TOKENS.primaryFg,
      fontSize: 11.5,
      fontWeight: 700,
      flexShrink: 0,
      border: `1px solid ${TOKENS.primarySoftBorder}`,
    }}>
      {n}
    </span>
  );
}
