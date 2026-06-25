// Utilitário de composição de classes no padrão shadcn (cn), sem dependência de
// Tailwind/clsx: concatena nomes de classe válidos, ignorando valores falsy.

export function cn(...inputs) {
  return inputs
    .flat(Infinity)
    .filter((value) => typeof value === 'string' && value.length > 0)
    .join(' ');
}
