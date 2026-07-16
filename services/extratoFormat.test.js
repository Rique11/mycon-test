/**
 * extratoFormat.test.js — testes da normalização do extrato para o formato
 * canônico de 5 colunas, cobrindo os formatos de texto por instituição
 * (pipe do Nubank, hífen de outros bancos, sem separador) e o saldo corrente
 * acumulado em ordem cronológica.
 */

import { describe, expect, it } from 'vitest';
import {
  buildExtratoLines,
  extratoSignedValue,
  groupStatementByInstitution,
  historicoLabel,
} from './extratoFormat.js';

function lineFor(row) {
  return buildExtratoLines({ rows: [row] }).lines[0];
}

describe('splitTransactionText via buildExtratoLines — formato Nubank (pipe)', () => {
  it('separa rótulo e contraparte no pipe sem espaços', () => {
    const line = lineFor({
      date: '2025-07-16',
      type: 'PIX',
      inflow: 200,
      transactionName: 'Transferência Recebida|JOSE ANTONIO V CASCAES',
    });
    expect(line.historico).toBe('Transferência Recebida');
    expect(line.descricao).toBe('JOSE ANTONIO V CASCAES');
  });

  it('separa rótulo e contraparte no pipe com espaços', () => {
    const line = lineFor({
      date: '2025-08-02',
      type: 'OPERACAO_CREDITO',
      outflow: 354.6,
      transactionName: 'Parcela Paga | Pagamentos diversos',
    });
    expect(line.historico).toBe('Parcela Paga');
    expect(line.descricao).toBe('Pagamentos diversos');
  });

  it('aceita rótulo longo do Nubank antes do pipe', () => {
    const line = lineFor({
      date: '2025-08-16',
      type: 'DEPOSITO',
      inflow: 150,
      transactionName:
        'Valor adicionado na conta por cartão de crédito | Valor adicionado para PIX no Crédito',
    });
    expect(line.historico).toBe('Valor adicionado na conta por cartão de crédito');
    expect(line.descricao).toBe('Valor adicionado para PIX no Crédito');
  });

  it('divide apenas no primeiro pipe', () => {
    const line = lineFor({
      date: '2025-09-01',
      type: 'CARTAO',
      outflow: 10,
      transactionName: 'Compra no débito|LOJA A|FILIAL B',
    });
    expect(line.historico).toBe('Compra no débito');
    expect(line.descricao).toBe('LOJA A|FILIAL B');
  });

  it('mantém contraparte com números e pontuação', () => {
    const line = lineFor({
      date: '2026-01-30',
      type: 'OUTROS',
      outflow: 20,
      transactionName: 'Recarga efetuada|(11) 96504-4728',
    });
    expect(line.historico).toBe('Recarga efetuada');
    expect(line.descricao).toBe('(11) 96504-4728');
  });
});

describe('splitTransactionText via buildExtratoLines — formato hífen e fallback', () => {
  it('separa rótulo e contraparte no " - " de outros bancos', () => {
    const line = lineFor({
      date: '2025-07-17',
      type: 'CARTAO',
      outflow: 16.98,
      transactionName: 'Compra no débito - Uber Trip',
    });
    expect(line.historico).toBe('Compra no débito');
    expect(line.descricao).toBe('Uber Trip');
  });

  it('sem separador e sem prefixo conhecido, deriva Histórico do type e mantém o texto na Descrição', () => {
    const line = lineFor({
      date: '2025-08-15',
      type: 'OUTROS',
      outflow: 2809.83,
      transactionName: 'Aplicação RDB',
    });
    expect(line.historico).toBe('Outros');
    expect(line.descricao).toBe('Aplicação RDB');
  });

  it('não trata contraparte longa com hífen como rótulo', () => {
    const texto = 'MARIA PAULA PEREIRA SANTOS DE SA COMERCIO - ME DE PRODUTOS';
    const line = lineFor({ date: '2025-09-01', type: 'PIX', inflow: 50, transactionName: texto });
    expect(line.historico).toBe('Pix recebido');
    expect(line.descricao).toBe(texto);
  });
});

describe('splitTransactionText via buildExtratoLines — formato Itaú (prefixo no texto)', () => {
  it('extrai o rótulo "Pix enviado com cartão" e mantém a contraparte', () => {
    const line = lineFor({
      date: '2025-07-30',
      type: 'OUTROS',
      outflow: 600,
      transactionName: 'Pix enviado com cartão IGREJA EVANGELICA PENTECOSTAL',
    });
    expect(line.historico).toBe('Pix enviado');
    expect(line.descricao).toBe('IGREJA EVANGELICA PENTECOSTAL');
  });

  it('normaliza "Compra débito" para "Compra no débito"', () => {
    const line = lineFor({
      date: '2025-07-23',
      type: 'OUTROS',
      outflow: 4.78,
      transactionName: 'Compra débito LUCIDINA',
    });
    expect(line.historico).toBe('Compra no débito');
    expect(line.descricao).toBe('LUCIDINA');
  });

  it('extrai "Crédito liberado" mantendo o restante como Descrição', () => {
    const line = lineFor({
      date: '2025-07-30',
      type: 'OUTROS',
      inflow: 600,
      transactionName: 'Crédito liberado para Pix TEF',
    });
    expect(line.historico).toBe('Crédito liberado');
    expect(line.descricao).toBe('para Pix TEF');
  });

  it('texto que é só o rótulo vira Histórico com Descrição vazia', () => {
    const line = lineFor({
      date: '2025-08-15',
      type: 'OUTROS',
      outflow: 2809.83,
      transactionName: 'Pagamento de fatura',
    });
    expect(line.historico).toBe('Pagamento de fatura');
    expect(line.descricao).toBe('');
  });

  it('separadores explícitos têm prioridade sobre o prefixo', () => {
    const line = lineFor({
      date: '2026-01-30',
      type: 'OUTROS',
      outflow: 20,
      transactionName: 'Recarga efetuada|(11) 96504-4728',
    });
    expect(line.historico).toBe('Recarga efetuada');
    expect(line.descricao).toBe('(11) 96504-4728');
  });
});

describe('historicoLabel', () => {
  it('deriva rótulo por type e sentido', () => {
    expect(historicoLabel('PIX', true)).toBe('Pix recebido');
    expect(historicoLabel('PIX', false)).toBe('Pix enviado');
    expect(historicoLabel('CARTAO', false)).toBe('Compra no débito');
  });

  it('humaniza códigos não mapeados', () => {
    expect(historicoLabel('OUTROS_CREDITOS', true)).toBe('Outros creditos');
  });
});

describe('extratoSignedValue e saldo corrente', () => {
  it('assina crédito positivo e débito negativo', () => {
    expect(extratoSignedValue({ inflow: 200 })).toBe(200);
    expect(extratoSignedValue({ outflow: 42 })).toBe(-42);
    expect(extratoSignedValue({ amount: -16.98 })).toBe(-16.98);
  });

  it('acumula o saldo em ordem cronológica a partir do saldo inicial', () => {
    const { opening, lines } = buildExtratoLines({
      openingBalance: 0,
      rows: [
        { date: '2025-07-16', type: 'PIX', inflow: 200, transactionName: 'Transferência Recebida|A' },
        { date: '2025-07-16', type: 'PIX', inflow: 42, transactionName: 'Transferência Recebida|B' },
        { date: '2025-07-17', type: 'CARTAO', outflow: 16.98, transactionName: 'Compra no débito|OBA HORTIFRUTI' },
      ],
    });
    expect(opening).toBe(0);
    expect(lines.map((l) => l.saldo)).toEqual([200, 242, 225.02]);
    expect(lines.map((l) => l.valor)).toEqual([200, 42, -16.98]);
  });
});

describe('groupStatementByInstitution', () => {
  it('mantém o extrato intacto quando há uma única instituição', () => {
    const statement = {
      openingBalance: 100,
      rows: [
        { date: '2025-07-16', bankName: 'Nubank', inflow: 200 },
        { date: '2025-07-17', bankName: 'Nubank', outflow: 50 },
      ],
    };
    const groups = groupStatementByInstitution(statement);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Nubank');
    expect(groups[0].statement).toBe(statement);
    expect(buildExtratoLines(groups[0].statement).opening).toBe(100);
  });

  it('mantém o extrato intacto quando as linhas não identificam instituição', () => {
    const statement = { rows: [{ date: '2025-07-16', inflow: 200 }] };
    const groups = groupStatementByInstitution(statement);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('');
    expect(groups[0].statement).toBe(statement);
  });

  it('separa um extrato por instituição com saldo corrente independente', () => {
    const statement = {
      openingBalance: 100,
      rows: [
        { date: '2025-07-16', bankName: 'Nubank', inflow: 200 },
        { date: '2025-07-16', bankName: 'Banco Itaú S.A.', inflow: 500 },
        { date: '2025-07-17', bankName: 'Nubank', outflow: 50 },
      ],
    };
    const groups = groupStatementByInstitution(statement);
    expect(groups.map((g) => g.label)).toEqual(['Nubank', 'Itau']);

    const nubank = buildExtratoLines(groups[0].statement);
    expect(nubank.opening).toBe(0);
    expect(nubank.lines.map((l) => l.saldo)).toEqual([200, 150]);

    const itau = buildExtratoLines(groups[1].statement);
    expect(itau.lines.map((l) => l.saldo)).toEqual([500]);
  });

  it('rotula instituições sem nome legível como genéricas numeradas', () => {
    const statement = {
      rows: [
        { date: '2025-07-16', institution: '01HZXK2J3M4N5P6Q7R8S9T0V1W', inflow: 10 },
        { date: '2025-07-17', bankName: 'Nubank', inflow: 20 },
      ],
    };
    const groups = groupStatementByInstitution(statement);
    expect(groups[0].label).toBe('Instituição 1 (01HZXK2J3M4N5P6Q7R…)');
    expect(groups[1].label).toBe('Nubank');
  });

  it('agrupa no mesmo extrato tokens distintos da mesma instituição', () => {
    const statement = {
      rows: [
        { date: '2025-07-16', bankName: 'Nubank', inflow: 10 },
        { date: '2025-07-17', institution: 'Nu Pagamentos', inflow: 20 },
      ],
    };
    const groups = groupStatementByInstitution(statement);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Nubank');
    expect(groups[0].statement.rows).toHaveLength(2);
  });
});
