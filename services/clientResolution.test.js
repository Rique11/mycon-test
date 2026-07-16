/**
 * clientResolution.test.js — testes da montagem da fila operacional
 * (buildQueueCases), cobrindo o enriquecimento da coluna de bancos com as
 * instituições resolvidas dos vínculos da API.
 */

import { describe, expect, it } from 'vitest';
import { buildQueueCases } from './clientResolution.js';

describe('buildQueueCases', () => {
  it('preenche os bancos de clientes que existem apenas na API', () => {
    const clients = [{ id: 'c1', name: 'Sofia', cpf: '10600000025', akropoliLinkId: 'lnk-1' }];
    const queue = buildQueueCases(clients, [], { c1: ['Inter'] });
    expect(queue).toHaveLength(1);
    expect(queue[0].fromApi).toBe(true);
    expect(queue[0].banks).toEqual(['Inter']);
    expect(queue[0].status).toBe('conectado');
  });

  it('enriquece caso local sem bancos registrados', () => {
    const cases = [{ id: 'pc-1', clientId: 'c2', cpf: '35100000006', banks: [], status: 'conectado' }];
    const queue = buildQueueCases([], cases, { c2: ['Nubank', 'Itau'] });
    expect(queue[0].banks).toEqual(['Nubank', 'Itau']);
  });

  it('não sobrescreve bancos já registrados no caso local', () => {
    const cases = [{ id: 'pc-1', clientId: 'c2', cpf: '35100000006', banks: ['Santander'], status: 'conectado' }];
    const queue = buildQueueCases([], cases, { c2: ['Nubank'] });
    expect(queue[0].banks).toEqual(['Santander']);
  });

  it('mantém bancos vazios sem mapa de instituições', () => {
    const clients = [{ id: 'c1', name: 'Sofia', cpf: '10600000025' }];
    const queue = buildQueueCases(clients, []);
    expect(queue[0].banks).toEqual([]);
    expect(queue[0].status).toBe('aguardando');
  });

  it('não duplica cliente da API que já tem caso local', () => {
    const clients = [{ id: 'c1', name: 'Sofia', cpf: '10600000025' }];
    const cases = [{ id: 'pc-1', clientId: 'c1', cpf: '10600000025', banks: [], status: 'conectado' }];
    const queue = buildQueueCases(clients, cases, { c1: ['Inter'] });
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe('pc-1');
    expect(queue[0].banks).toEqual(['Inter']);
  });
});
