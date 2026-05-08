import { TOKENS } from '../tokens.js';

export default function StepNumber({ n }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: TOKENS.primarySoft,
      color: TOKENS.primary,
      fontSize: 11.5,
      fontWeight: 700,
      flexShrink: 0,
    }}>
      {n}
    </span>
  );
}
