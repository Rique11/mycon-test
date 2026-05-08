/**
 * Mapa de cores por categoria de despesa, compartilhado entre cards de
 * insights e gráficos.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  alimentacao: '#2B5231',
  transporte: '#3A6B42',
  saude: '#C9A96E',
  lazer: '#9BC1A6',
  educacao: '#5A8c66',
  moradia: '#1C3320',
  vestuario: '#6B8F72',
  tecnologia: '#5D4E8C',
  servicos: '#A8C5B0',
  viagens: '#E8C882',
  financeiro: '#8B7355',
  investimento: '#4A7659',
  transferencia: '#7BA4C9',
  consorcio: '#8B6F2D',
  outros: '#94a3b8',
};

export const CATEGORY_FALLBACK_COLOR = '#94a3b8';
