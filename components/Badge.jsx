// Badge no padrão shadcn: variantes por tom (tone) e tamanho (size) via classes
// CSS do tema Lizard, com ponto opcional. API: tone, size, dot, children/label.

import { cn } from '../lib/utils.js';

const TONE_CLASS = {
  blue: 'badge-blue',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  purple: 'badge-purple',
  neutral: 'badge-neutral',
};

export default function Badge({ tone = 'neutral', size = 'sm', dot = false, className = '', children, label }) {
  return (
    <span className={cn('badge', size === 'md' ? 'badge-md' : 'badge-sm', TONE_CLASS[tone] ?? TONE_CLASS.neutral, className)}>
      {dot && <span className="badge-dot" />}
      {children ?? label}
    </span>
  );
}
