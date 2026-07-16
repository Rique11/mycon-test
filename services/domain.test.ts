/**
 * domain.test.ts — testes unitários das regras de negócio puras da POC.
 */

import { describe, expect, it } from 'vitest';
import {
  POC_STATUS,
  QUEUE_ACTIONS,
  computeRecurringIncome,
  confTone,
  getConsentStartFromLinks,
  getPromotedStatus,
  getQueueBusinessRules,
  getStatusMeta,
  groupDetail,
  hasReadyEvidence,
  isConsentAccepted,
  mapMonth,
  receiptMethod,
  receitaTrimestral,
  recurringDetailByMonth,
  sourceKey,
} from './domain';

describe('getStatusMeta', () => {
  it('retorna o status conhecido', () => {
    expect(getStatusMeta('pronto')).toBe(POC_STATUS.pronto);
  });

  it('cai em aguardando para status desconhecido ou ausente', () => {
    expect(getStatusMeta('inexistente')).toBe(POC_STATUS.aguardando);
    expect(getStatusMeta(undefined)).toBe(POC_STATUS.aguardando);
  });
});

describe('isConsentAccepted', () => {
  it('aceita por status do caso', () => {
    expect(isConsentAccepted({ id: 'x', status: 'conectado' })).toBe(true);
    expect(isConsentAccepted({ id: 'x', status: 'pronto' })).toBe(true);
  });

  it('aceita por status do consentimento da API', () => {
    expect(isConsentAccepted({ id: 'x', status: 'enviado', consent: { status: 'ACCEPTED' } })).toBe(true);
    expect(isConsentAccepted({ id: 'x', status: 'enviado', consent: { state: 'autorizado' } })).toBe(true);
  });

  it('aceita por evidência pronta', () => {
    expect(isConsentAccepted({ id: 'x', status: 'enviado' }, { evidenceReady: true })).toBe(true);
  });

  it('rejeita caso pendente', () => {
    expect(isConsentAccepted({ id: 'x', status: 'enviado' })).toBe(false);
  });
});

describe('hasReadyEvidence', () => {
  it('reconhece evidência por extrato ou composição de renda', () => {
    expect(hasReadyEvidence({ statement: { rows: [{}] }, income: null })).toBe(true);
    expect(hasReadyEvidence({ statement: null, income: { months: [{}] } })).toBe(true);
  });

  it('rejeita payload vazio ou ausente', () => {
    expect(hasReadyEvidence({ statement: { rows: [] }, income: { months: [] } })).toBe(false);
    expect(hasReadyEvidence(null)).toBe(false);
  });
});

describe('getPromotedStatus', () => {
  const readyEvidence = { statement: { rows: [{}] }, income: null };

  it('promove caso pré-consentimento com evidência pronta', () => {
    expect(getPromotedStatus({ id: 'x', status: 'enviado' }, readyEvidence)).toBe('conectado');
    expect(getPromotedStatus({ id: 'x', status: 'aguardando' }, readyEvidence)).toBe('conectado');
    expect(getPromotedStatus({ id: 'x', status: 'expirado' }, readyEvidence)).toBe('conectado');
  });

  it('não promove sem evidência', () => {
    expect(getPromotedStatus({ id: 'x', status: 'enviado' }, { statement: { rows: [] } })).toBe(null);
  });

  it('não rebaixa status já aceito nem sobrescreve exceções operacionais', () => {
    expect(getPromotedStatus({ id: 'x', status: 'pronto' }, readyEvidence)).toBe(null);
    expect(getPromotedStatus({ id: 'x', status: 'conectado' }, readyEvidence)).toBe(null);
    expect(getPromotedStatus({ id: 'x', status: 'escalado' }, readyEvidence)).toBe(null);
    expect(getPromotedStatus({ id: 'x', status: 'manual' }, readyEvidence)).toBe(null);
  });
});

describe('getQueueBusinessRules', () => {
  const now = '2026-07-08T12:00:00.000Z';

  it('consentimento aceito', () => {
    const rules = getQueueBusinessRules({ id: 'x', status: 'conectado' }, { now });
    expect(rules.accepted).toBe(true);
    expect(rules.nextAction).toBe(QUEUE_ACTIONS.accessOutputs);
  });

  it('link recente (até 5 dias) fica com o cliente', () => {
    const rules = getQueueBusinessRules(
      { id: 'x', status: 'enviado', consentCreatedAt: '2026-07-05T12:00:00.000Z' },
      { now },
    );
    expect(rules.key).toBe('link-gerado');
    expect(rules.owner).toBe('Cliente');
  });

  it('link antigo (mais de 5 dias) vira pendência de investigação', () => {
    const rules = getQueueBusinessRules(
      { id: 'x', status: 'enviado', consentCreatedAt: '2026-06-20T12:00:00.000Z' },
      { now },
    );
    expect(rules.key).toBe('sem-consentimento');
    expect(rules.nextAction).toBe(QUEUE_ACTIONS.investigateNoConsent);
  });
});

describe('classificação de lançamentos', () => {
  it('mapMonth converte valores e protege contra ausentes', () => {
    const m = mapMonth({ yearMonth: '2025-05', recurring: '1000', validatedIncome: 1000, totalCredits: 1500 });
    expect(m.label).toBe('Mai/25');
    expect(m.rec).toBe(1000);
    expect(m.val).toBe(1000);
    expect(m.nrec).toBe(0);
    expect(m.conf).toBe('Baixa');
  });

  it('groupDetail separa receita de transferências entre contas do titular', () => {
    const groups = groupDetail([
      { classification: 'REC', amount: 100, date: '2025-05-01', description: 'CRED RECEBIMENTO PIX' },
      { classification: 'ENT', amount: 50, date: '2025-05-02', description: 'TED MESMA TITULARIDADE' },
      { classification: 'NREC', amount: 10, date: '2025-05-03', description: 'PAGAMENTO BOLETO' },
    ]);
    expect(groups.receita.items).toHaveLength(2);
    expect(groups.ent.items).toHaveLength(1);
    expect(groups.receita.items[0].met).toBe('PIX');
    expect(groups.ent.items[0].met).toBe('TED');
  });

  it('groupDetail aceita lista vazia ou nula', () => {
    const groups = groupDetail(null);
    expect(Object.keys(groups)).toHaveLength(2);
    expect(groups.receita.items).toHaveLength(0);
  });

  it('receita do mês exclui transferências entre contas e nunca fica negativa', () => {
    const m = mapMonth({ yearMonth: '2025-05', totalCredits: 1500, betweenAccounts: 500 });
    expect(m.total).toBe(1500);
    expect(m.receita).toBe(1000);

    const semEntre = mapMonth({ yearMonth: '2025-05', totalCredits: 1500 });
    expect(semEntre.receita).toBe(1500);

    const inconsistente = mapMonth({ yearMonth: '2025-05', totalCredits: 200, betweenAccounts: 500 });
    expect(inconsistente.receita).toBe(0);
  });
});

describe('receiptMethod', () => {
  it('identifica o método de recebimento pela descrição do lançamento', () => {
    expect(receiptMethod('FABRICIO HOOG CRED RECEBIMENTO PIX')).toBe('PIX');
    expect(receiptMethod('TED RECEBIDA')).toBe('TED');
    expect(receiptMethod('DOC RECEBIDO')).toBe('DOC');
    expect(receiptMethod('PAGAMENTO BOLETO')).toBe('Boleto');
    expect(receiptMethod('CONTA REMUNERADA - RESGATE APLICAÇÃO')).toBe('Resgate');
    expect(receiptMethod('CREDITO DIVERSO')).toBe('Outros');
    expect(receiptMethod(undefined)).toBe('Outros');
  });
});

describe('sourceKey', () => {
  it('normaliza a fonte pagadora independente da ordem e dos termos de método', () => {
    expect(sourceKey('FABRICIO HOOG CRED RECEBIMENTO PIX')).toBe(sourceKey('PIX RECEBIDO FABRICIO HOOG'));
    expect(sourceKey('EMPRESA XYZ LTDA - TED 123456')).toBe('EMPRESA LTDA XYZ');
    expect(sourceKey(undefined)).toBe('');
  });
});

describe('computeRecurringIncome', () => {
  it('critério 1: mesmo valor em 2+ meses consecutivos é recorrente', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2025-01', amount: 100, classification: 'NREC', description: 'PIX FONTE A' },
      { yearMonth: '2025-02', amount: 100, classification: 'NREC', description: 'PIX FONTE B' },
      { yearMonth: '2025-04', amount: 100, classification: 'NREC', description: 'PIX FONTE C' },
    ]);
    expect(r.total).toBe(200);
    expect(r.entryCount).toBe(2);
  });

  it('critério 2: mesma fonte em 3+ meses consecutivos é recorrente mesmo com valores variáveis', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2025-01', amount: 90, classification: 'NREC', description: 'PIX RECEBIDO EMPRESA XYZ' },
      { yearMonth: '2025-02', amount: 110, classification: 'NREC', description: 'EMPRESA XYZ CRED PIX' },
      { yearMonth: '2025-03', amount: 130, classification: 'NREC', description: 'PIX EMPRESA XYZ' },
    ]);
    expect(r.total).toBe(330);
    expect(r.entryCount).toBe(3);
  });

  it('mesma fonte em apenas 2 meses consecutivos com valores diferentes não é recorrente', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2025-01', amount: 90, classification: 'NREC', description: 'PIX EMPRESA XYZ' },
      { yearMonth: '2025-02', amount: 110, classification: 'NREC', description: 'PIX EMPRESA XYZ' },
    ]);
    expect(r.total).toBe(0);
  });

  it('mesmo valor em meses não consecutivos não é recorrente', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2025-01', amount: 100, classification: 'NREC', description: 'PIX FONTE A' },
      { yearMonth: '2025-03', amount: 100, classification: 'NREC', description: 'PIX FONTE B' },
    ]);
    expect(r.total).toBe(0);
  });

  it('ignora transferências entre contas e créditos atípicos', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2025-01', amount: 100, classification: 'ENT', description: 'TED MESMA TITULARIDADE' },
      { yearMonth: '2025-02', amount: 100, classification: 'ENT', description: 'TED MESMA TITULARIDADE' },
      { yearMonth: '2025-01', amount: 500, classification: 'ATIP', description: 'ESTORNO COMPRA' },
      { yearMonth: '2025-02', amount: 500, classification: 'ATIP', description: 'ESTORNO COMPRA' },
    ]);
    expect(r.total).toBe(0);
  });

  it('aceita lista vazia ou nula', () => {
    expect(computeRecurringIncome(null)).toEqual({ total: 0, entryCount: 0 });
    expect(computeRecurringIncome([])).toEqual({ total: 0, entryCount: 0 });
  });

  it('considera virada de ano como meses consecutivos', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2024-12', amount: 100, classification: 'NREC', description: 'PIX FONTE A' },
      { yearMonth: '2025-01', amount: 100, classification: 'NREC', description: 'PIX FONTE B' },
    ]);
    expect(r.total).toBe(200);
  });
});

describe('receitaTrimestral', () => {
  it('soma a receita dos últimos 3 meses', () => {
    const meses = [
      mapMonth({ yearMonth: '2025-01', totalCredits: 100 }),
      mapMonth({ yearMonth: '2025-02', totalCredits: 200 }),
      mapMonth({ yearMonth: '2025-03', totalCredits: 300 }),
      mapMonth({ yearMonth: '2025-04', totalCredits: 400 }),
    ];
    expect(receitaTrimestral(meses)).toBe(900);
  });

  it('funciona com menos de 3 meses', () => {
    expect(receitaTrimestral([mapMonth({ yearMonth: '2025-04', totalCredits: 400 })])).toBe(400);
    expect(receitaTrimestral([])).toBe(0);
  });

  it('desconsidera transferências entre contas na soma trimestral', () => {
    const meses = [
      mapMonth({ yearMonth: '2025-02', totalCredits: 200, betweenAccounts: 50 }),
      mapMonth({ yearMonth: '2025-03', totalCredits: 300, betweenAccounts: 100 }),
      mapMonth({ yearMonth: '2025-04', totalCredits: 400, betweenAccounts: 0 }),
    ];
    expect(receitaTrimestral(meses)).toBe(750);
  });
});

describe('recurringDetailByMonth', () => {
  it('renda recorrente ate o ultimo mes analisado fica com status N meses (ongoing)', () => {
    const lines = [
      { yearMonth: '2025-01', amount: 100, classification: 'NREC', description: 'PIX FONTE A', date: '01/01' },
      { yearMonth: '2025-02', amount: 100, classification: 'NREC', description: 'PIX FONTE B', date: '01/02' },
      { yearMonth: '2025-03', amount: 100, classification: 'NREC', description: 'PIX FONTE C', date: '01/03' },
      { yearMonth: '2025-04', amount: 100, classification: 'NREC', description: 'PIX FONTE D', date: '01/04' },
    ];
    const mesesAnalisados = ['2025-01', '2025-02', '2025-03', '2025-04'].map((id) => ({ id }));
    const byMonth = recurringDetailByMonth(lines, mesesAnalisados);
    expect(byMonth['2025-04']).toHaveLength(1);
    expect(byMonth['2025-04'][0].statusOngoing).toBe(true);
    expect(byMonth['2025-04'][0].statusLabel).toBe('4 meses');
    expect(byMonth['2025-01'][0].statusLabel).toBe('4 meses');
  });

  it('renda recorrente que termina antes do ultimo mes fica com status de periodo (nao ongoing)', () => {
    const meses = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'].map((id) => ({ id }));
    const lines = [
      { yearMonth: '2025-01', amount: 90, classification: 'NREC', description: 'PIX EMPRESA XYZ' },
      { yearMonth: '2025-02', amount: 110, classification: 'NREC', description: 'EMPRESA XYZ CRED PIX' },
      { yearMonth: '2025-03', amount: 130, classification: 'NREC', description: 'PIX EMPRESA XYZ' },
    ];
    const byMonth = recurringDetailByMonth(lines, meses);
    expect(byMonth['2025-03'][0].statusOngoing).toBe(false);
    expect(byMonth['2025-03'][0].statusLabel).toBe('Jan/25 - Mar/25');
    expect(byMonth['2025-04']).toBeUndefined();
  });

  it('ignora lancamentos que nao atendem aos criterios de recorrencia ou sao ENT/ATIP', () => {
    const meses = ['2025-01', '2025-02', '2025-03'].map((id) => ({ id }));
    const lines = [
      { yearMonth: '2025-01', amount: 100, classification: 'NREC', description: 'PIX FONTE A' },
      { yearMonth: '2025-03', amount: 100, classification: 'NREC', description: 'PIX FONTE B' },
      { yearMonth: '2025-01', amount: 500, classification: 'ENT', description: 'TED MESMA TITULARIDADE' },
    ];
    const byMonth = recurringDetailByMonth(lines, meses);
    expect(byMonth['2025-01']).toBeUndefined();
    expect(byMonth['2025-03']).toBeUndefined();
  });

  it('aceita lista de lancamentos vazia ou nula', () => {
    const meses = [{ id: '2025-01' }];
    expect(recurringDetailByMonth([], meses)).toEqual({});
    expect(recurringDetailByMonth(null, meses)).toEqual({});
  });

  it('retorna vazio quando nao ha meses analisados', () => {
    expect(recurringDetailByMonth([{ yearMonth: '2025-01', amount: 100, description: 'PIX' }], [])).toEqual({});
  });
});

describe('confTone', () => {
  it('mapeia confiança para tom visual', () => {
    expect(confTone('Alta')).toBe('success');
    expect(confTone('Média')).toBe('warning');
    expect(confTone('Media')).toBe('warning');
    expect(confTone('Baixa')).toBe('danger');
    expect(confTone(undefined)).toBe('danger');
  });
});

describe('getConsentStartFromLinks', () => {
  it('usa o menor connectedAt entre os links não revogados', () => {
    const links = [
      { linkId: 'a', status: 'ACTIVE', connectedAt: '2026-07-15T18:10:00Z' },
      { linkId: 'b', status: 'ACTIVE', connectedAt: '2026-07-15T14:05:00Z' },
    ];
    expect(getConsentStartFromLinks(links)?.toISOString()).toBe('2026-07-15T14:05:00.000Z');
  });

  it('ignora links revogados', () => {
    const links = [
      { linkId: 'a', status: 'REVOKED', connectedAt: '2026-07-10T10:00:00Z' },
      { linkId: 'b', status: 'ACTIVE', connectedAt: '2026-07-15T14:05:00Z' },
    ];
    expect(getConsentStartFromLinks(links)?.toISOString()).toBe('2026-07-15T14:05:00.000Z');
  });

  it('devolve null sem links ou sem connectedAt válido', () => {
    expect(getConsentStartFromLinks(null)).toBeNull();
    expect(getConsentStartFromLinks([])).toBeNull();
    expect(getConsentStartFromLinks([{ linkId: 'a', status: 'ACTIVE' }])).toBeNull();
    expect(getConsentStartFromLinks([{ linkId: 'a', status: 'ACTIVE', connectedAt: 'data-invalida' }])).toBeNull();
  });
});
