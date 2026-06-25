// Botão no padrão shadcn: API de variantes (variant/size) sobre classes CSS do
// tema Lizard. Encaminha demais props para o elemento <button>.

import { cn } from '../lib/utils.js';

const VARIANT_CLASS = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  outline: 'btn-outline',
  secondary: 'btn-secondary',
};

const SIZE_STYLE = {
  sm: { padding: '7px 12px', fontSize: 12.5 },
  default: { padding: '10px 16px', fontSize: 13.5 },
  lg: { padding: '11px 20px', fontSize: 14 },
  icon: { padding: 0, width: 36, height: 36 },
};

export default function Button({
  variant = 'primary',
  size = 'default',
  className = '',
  style = {},
  type = 'button',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn('btn', VARIANT_CLASS[variant] ?? VARIANT_CLASS.primary, className)}
      style={{ ...SIZE_STYLE[size], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
