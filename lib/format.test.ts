/**
 * format.test.ts — testes unitários dos helpers de formatação compartilhados.
 */

import { describe, expect, it } from 'vitest';
import { escapeHtml, fmtBRL, fmtDate, maskCpf, mesLabel, num, onlyDigits, periodo, slug, ymLabels } from './format';

describe('num', () => {
  it('converte valores numéricos e strings', () => {
    expect(num(10)).toBe(10);
    expect(num('2.5')).toBe(2.5);
  });

  it('retorna 0 para null, undefined e NaN', () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
    expect(num(Infinity)).toBe(0);
  });
});

describe('fmtBRL', () => {
  it('formata valores em reais', () => {
    expect(fmtBRL(1234.5)).toBe('R$ 1.234,50');
    expect(fmtBRL('1234.5')).toBe('R$ 1.234,50');
  });

  it('não produz "R$ NaN" para entradas inválidas', () => {
    expect(fmtBRL(null)).toBe('R$ 0,00');
    expect(fmtBRL('abc')).toBe('R$ 0,00');
    expect(fmtBRL(undefined)).toBe('R$ 0,00');
  });
});

describe('fmtDate', () => {
  it('formata ISO como dd/mm/aa', () => {
    expect(fmtDate('2026-06-28T12:00:00.000Z')).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
  });

  it('retorna travessão para vazio ou inválido', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('data-invalida')).toBe('—');
  });
});

describe('onlyDigits', () => {
  it('remove tudo que não é dígito', () => {
    expect(onlyDigits('(11) 99999-9999')).toBe('11999999999');
    expect(onlyDigits('123.456.789-00')).toBe('12345678900');
    expect(onlyDigits(null)).toBe('');
  });
});

describe('maskCpf', () => {
  it('aplica a política única XXX.***.***-XX', () => {
    expect(maskCpf('12345678900')).toBe('123.***.***-00');
    expect(maskCpf('123.456.789-00')).toBe('123.***.***-00');
  });

  it('retorna o valor original quando não há 11 dígitos', () => {
    expect(maskCpf('123')).toBe('123');
    expect(maskCpf('')).toBe('');
  });
});

describe('meses e períodos', () => {
  it('ymLabels e mesLabel', () => {
    expect(ymLabels('2025-05')).toEqual({ label: 'Mai/25', long: 'Maio/2025' });
    expect(mesLabel('2025-12')).toBe('Dez/25');
    expect(mesLabel(null)).toBe('');
  });

  it('ymLabels não estoura índice com mês inválido', () => {
    expect(ymLabels('2025-13').label).toBe('Dez/25');
    expect(ymLabels('2025-00').label).toBe('Jan/25');
  });

  it('periodo', () => {
    expect(periodo({ fromYearMonth: '2025-01', toYearMonth: '2025-12' })).toBe('Jan/25 a Dez/25');
    expect(periodo(null)).toBe('—');
    expect(periodo({})).toBe('—');
  });
});

describe('slug', () => {
  it('normaliza acentos e separadores', () => {
    expect(slug('João da Silva')).toBe('joao-da-silva');
    expect(slug(null)).toBe('cliente');
  });
});

describe('escapeHtml', () => {
  it('escapa caracteres perigosos', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(escapeHtml("a & 'b'")).toBe('a &amp; &#39;b&#39;');
    expect(escapeHtml(null)).toBe('');
  });
});
