// Card no padrão shadcn: superfície branca com borda e raio do tema Lizard via
// classe CSS .card, aceitando override de padding, estilos e handlers extras.

import { cn } from '../lib/utils.js';

export default function Card({ children, padding = '18px 20px', className = '', style = {}, ...props }) {
  return (
    <div className={cn('card', className)} style={{ padding, ...style }} {...props}>
      {children}
    </div>
  );
}
