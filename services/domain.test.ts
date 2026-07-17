/**
 * domain.test.ts — testes unitários das regras de negócio puras da POC.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DECISION_CRITERIA,
  isMesCorrente,
  statementWindow,
  POC_STATUS,
  QUEUE_ACTIONS,
  classifyPerfilRenda,
  computeRecurringIncome,
  computeRendaStats,
  computeTendenciaRenda,
  confTone,
  evaluateDecision,
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
  sanitizeDecisionCriteria,
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
  it('soma os créditos classificados como recorrentes pelo backend (considered=true)', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2025-01', amount: 100, classification: 'REC', considered: true, description: 'SALARIO EMPRESA XYZ' },
      { yearMonth: '2025-02', amount: 120, classification: 'PIX', considered: true, description: 'PIX EMPRESA XYZ' },
      { yearMonth: '2025-02', amount: 500, classification: 'NREC', considered: false, description: 'VENDA AVULSA' },
    ]);
    expect(r.total).toBe(220);
    expect(r.entryCount).toBe(2);
  });

  it('sem o campo considered, usa a classificação REC/PIX', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2025-01', amount: 100, classification: 'REC', description: 'SALARIO EMPRESA XYZ' },
      { yearMonth: '2025-02', amount: 200, classification: 'NREC', description: 'VENDA AVULSA' },
    ]);
    expect(r.total).toBe(100);
    expect(r.entryCount).toBe(1);
  });

  it('ignora transferências entre contas e créditos atípicos', () => {
    const r = computeRecurringIncome([
      { yearMonth: '2025-01', amount: 100, classification: 'ENT', considered: false, description: 'TED MESMA TITULARIDADE' },
      { yearMonth: '2025-01', amount: 500, classification: 'ATIP', considered: false, description: 'ESTORNO COMPRA' },
    ]);
    expect(r.total).toBe(0);
  });

  it('aceita lista vazia ou nula', () => {
    expect(computeRecurringIncome(null)).toEqual({ total: 0, entryCount: 0 });
    expect(computeRecurringIncome([])).toEqual({ total: 0, entryCount: 0 });
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
  it('pagador recorrente presente no ultimo mes analisado fica com status N meses (ongoing)', () => {
    const lines = ['2025-01', '2025-02', '2025-03', '2025-04'].map((yearMonth, i) => ({
      yearMonth, amount: 100 + i, classification: 'REC', considered: true,
      description: 'SALARIO EMPRESA XYZ', date: `01/0${i + 1}`,
    }));
    const mesesAnalisados = ['2025-01', '2025-02', '2025-03', '2025-04'].map((id) => ({ id }));
    const byMonth = recurringDetailByMonth(lines, mesesAnalisados);
    expect(byMonth['2025-04']).toHaveLength(1);
    expect(byMonth['2025-04'][0].statusOngoing).toBe(true);
    expect(byMonth['2025-04'][0].statusLabel).toBe('4 meses');
    expect(byMonth['2025-01'][0].statusLabel).toBe('4 meses');
  });

  it('pagador que deixa de creditar antes do ultimo mes fica com status de periodo (nao ongoing)', () => {
    const meses = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'].map((id) => ({ id }));
    const lines = [
      { yearMonth: '2025-01', amount: 90, classification: 'REC', considered: true, description: 'PIX EMPRESA XYZ' },
      { yearMonth: '2025-02', amount: 110, classification: 'REC', considered: true, description: 'EMPRESA XYZ CRED PIX' },
      { yearMonth: '2025-03', amount: 130, classification: 'REC', considered: true, description: 'PIX EMPRESA XYZ' },
    ];
    const byMonth = recurringDetailByMonth(lines, meses);
    expect(byMonth['2025-03'][0].statusOngoing).toBe(false);
    expect(byMonth['2025-03'][0].statusLabel).toBe('Jan/25 - Mar/25');
    expect(byMonth['2025-04']).toBeUndefined();
  });

  it('ignora lancamentos nao classificados como recorrentes pelo backend', () => {
    const meses = ['2025-01', '2025-02', '2025-03'].map((id) => ({ id }));
    const lines = [
      { yearMonth: '2025-01', amount: 100, classification: 'NREC', considered: false, description: 'PIX FONTE A' },
      { yearMonth: '2025-03', amount: 100, classification: 'NREC', considered: false, description: 'PIX FONTE B' },
      { yearMonth: '2025-01', amount: 500, classification: 'ENT', considered: false, description: 'TED MESMA TITULARIDADE' },
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
    expect(recurringDetailByMonth([{ yearMonth: '2025-01', amount: 100, classification: 'REC', description: 'PIX' }], [])).toEqual({});
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

describe('sanitizeDecisionCriteria', () => {
  it('mantém valores válidos e arredonda meses recorrentes', () => {
    const c = sanitizeDecisionCriteria({ rendaMinima: 2000, debitoRendaMax: 2.5, volatilidadeMax: 0.3, mesesRecorrentesMin: 5.6 });
    expect(c).toEqual({ rendaMinima: 2000, debitoRendaMax: 2.5, volatilidadeMax: 0.3, mesesRecorrentesMin: 6 });
  });

  it('preenche campos ausentes, negativos ou não numéricos com os defaults', () => {
    expect(sanitizeDecisionCriteria(null)).toEqual(DEFAULT_DECISION_CRITERIA);
    const c = sanitizeDecisionCriteria({ rendaMinima: -1, debitoRendaMax: Number.NaN, volatilidadeMax: undefined });
    expect(c.rendaMinima).toBe(DEFAULT_DECISION_CRITERIA.rendaMinima);
    expect(c.debitoRendaMax).toBe(DEFAULT_DECISION_CRITERIA.debitoRendaMax);
    expect(c.volatilidadeMax).toBe(DEFAULT_DECISION_CRITERIA.volatilidadeMax);
  });

  it('aceita critérios em string vindos de formulário', () => {
    const c = sanitizeDecisionCriteria({ rendaMinima: '2500' as unknown as number, mesesRecorrentesMin: '3' as unknown as number });
    expect(c.rendaMinima).toBe(2500);
    expect(c.mesesRecorrentesMin).toBe(3);
  });
});

describe('evaluateDecision', () => {
  const criteria = { rendaMinima: 1500, debitoRendaMax: 3, volatilidadeMax: 0.4, mesesRecorrentesMin: 4 };

  it('sem renda comprovável recomenda complementar', () => {
    const r = evaluateDecision({ rendaVerificada: 0, debitoRenda: 0.5, volatilidade: 0.1, mesesRecorrentes: 0 }, criteria);
    expect(r.level).toBe('complementar');
    expect(r.incomeProven).toBe(false);
  });

  it('poucos meses recorrentes recomenda complementar mesmo com renda alta', () => {
    const r = evaluateDecision({ rendaVerificada: 8000, debitoRenda: 1, volatilidade: 0.1, mesesRecorrentes: 3 }, criteria);
    expect(r.level).toBe('complementar');
  });

  it('renda comprovável dentro de todos os critérios recomenda aprovar', () => {
    const r = evaluateDecision({ rendaVerificada: 3000, debitoRenda: 2, volatilidade: 0.2, mesesRecorrentes: 6 }, criteria);
    expect(r.level).toBe('aprovar');
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  it('renda comprovável fora de um critério secundário recomenda revisar', () => {
    const alto = evaluateDecision({ rendaVerificada: 3000, debitoRenda: 5, volatilidade: 0.2, mesesRecorrentes: 6 }, criteria);
    expect(alto.level).toBe('revisar');
    const baixa = evaluateDecision({ rendaVerificada: 800, debitoRenda: 1, volatilidade: 0.2, mesesRecorrentes: 6 }, criteria);
    expect(baixa.level).toBe('revisar');
  });

  it('fatores sem dado (null) não reprovam a comprovação', () => {
    const r = evaluateDecision({ rendaVerificada: 3000, debitoRenda: null, volatilidade: null, mesesRecorrentes: 6 }, criteria);
    expect(r.level).toBe('aprovar');
  });

  it('usa os defaults quando nenhum critério é informado', () => {
    const r = evaluateDecision({ rendaVerificada: 3000, debitoRenda: 2, volatilidade: 0.2, mesesRecorrentes: 6 });
    expect(r.level).toBe('aprovar');
  });
});

describe('computeRendaStats', () => {
  const month = (yearMonth: string, validatedIncome: number) => ({
    yearMonth,
    recurring: validatedIncome,
    pixRecurring: 0,
    betweenAccounts: 0,
    nonRecurring: 0,
    atypical: 0,
    totalCredits: validatedIncome,
    validatedIncome,
    confidence: 'Alta',
  });

  it('calcula média 12m e volatilidade sobre a renda verificada', () => {
    const income = {
      months: [month('2026-01', 3000), month('2026-02', 3000), month('2026-03', 3000)],
      summary: { monthsAnalyzed: 3 },
    };
    const r = computeRendaStats(income);
    expect(r.media12m).toBe(3000);
    expect(r.volatilidade).toBe(0);
  });

  it('completa com zeros os meses ausentes da janela analisada', () => {
    const income = {
      months: [month('2026-05', 4000), month('2026-06', 4000)],
      summary: { monthsAnalyzed: 4 },
    };
    const r = computeRendaStats(income);
    expect(r.media12m).toBe(2000);
    expect(r.volatilidade).toBeCloseTo(1, 5);
  });

  it('meses com renda zero contam como instabilidade, não são filtrados', () => {
    const estavel = computeRendaStats({
      months: [month('2026-01', 5000), month('2026-02', 5000)],
      summary: { monthsAnalyzed: 2 },
    });
    const intermitente = computeRendaStats({
      months: [month('2026-01', 5000), month('2026-02', 0), month('2026-03', 5000), month('2026-04', 0)],
      summary: { monthsAnalyzed: 4 },
    });
    expect(estavel.volatilidade).toBe(0);
    expect(intermitente.volatilidade).toBeGreaterThan(0.5);
  });

  it('retorna null sem dados ou com renda toda zerada', () => {
    expect(computeRendaStats(null)).toEqual({ media12m: null, volatilidade: null });
    expect(computeRendaStats({ months: [], summary: { monthsAnalyzed: 0 } }))
      .toEqual({ media12m: null, volatilidade: null });
    const zerada = computeRendaStats({
      months: [month('2026-01', 0), month('2026-02', 0)],
      summary: { monthsAnalyzed: 2 },
    });
    expect(zerada.media12m).toBe(0);
    expect(zerada.volatilidade).toBeNull();
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

describe('computeTendenciaRenda', () => {
  const month = (yearMonth: string, validatedIncome: number) => ({ yearMonth, validatedIncome });

  it('renda subindo mais de 10% é crescente', () => {
    const income = {
      fromYearMonth: '2026-01',
      toYearMonth: '2026-06',
      months: [
        month('2026-01', 2000), month('2026-02', 2000), month('2026-03', 2000),
        month('2026-04', 3000), month('2026-05', 3000), month('2026-06', 3000),
      ],
    };
    const r = computeTendenciaRenda(income);
    expect(r.tendencia).toBe('crescente');
    expect(r.variacao).toBeCloseTo(0.5, 5);
  });

  it('variação dentro de ±10% é estável', () => {
    const income = {
      fromYearMonth: '2026-01',
      toYearMonth: '2026-06',
      months: [
        month('2026-01', 3000), month('2026-02', 3000), month('2026-03', 3000),
        month('2026-04', 3100), month('2026-05', 2900), month('2026-06', 3000),
      ],
    };
    expect(computeTendenciaRenda(income).tendencia).toBe('estavel');
  });

  it('meses ausentes na janela contam como zero e derrubam a tendência', () => {
    const income = {
      fromYearMonth: '2026-01',
      toYearMonth: '2026-06',
      months: [
        month('2026-01', 3000), month('2026-02', 3000), month('2026-03', 3000),
        month('2026-04', 3000),
      ],
    };
    const r = computeTendenciaRenda(income);
    expect(r.tendencia).toBe('decrescente');
    expect(r.variacao).toBeCloseTo(-2 / 3, 5);
  });

  it('sem base de comparação, renda nova é crescente sem variação numérica', () => {
    const income = {
      fromYearMonth: '2026-01',
      toYearMonth: '2026-06',
      months: [month('2026-04', 3000), month('2026-05', 3000), month('2026-06', 3000)],
    };
    const r = computeTendenciaRenda(income);
    expect(r.tendencia).toBe('crescente');
    expect(r.variacao).toBeNull();
  });

  it('retorna null com menos de 6 meses na janela ou sem dados', () => {
    expect(computeTendenciaRenda(null).tendencia).toBeNull();
    expect(computeTendenciaRenda({ months: [] }).tendencia).toBeNull();
    const curta = {
      fromYearMonth: '2026-03',
      toYearMonth: '2026-06',
      months: [month('2026-03', 3000), month('2026-06', 3000)],
    };
    expect(computeTendenciaRenda(curta).tendencia).toBeNull();
  });
});

describe('classifyPerfilRenda', () => {
  it('descrição com indício de salário/folha classifica como folha', () => {
    const r = classifyPerfilRenda([
      { amount: 3000, classification: 'REC', considered: true, description: 'SALÁRIO EMPRESA XYZ', personType: 'PESSOA_JURIDICA' },
    ]);
    expect(r.perfil).toBe('folha');
  });

  it('pagador recorrente PJ sem indício de folha classifica como recorrente-pj', () => {
    const r = classifyPerfilRenda([
      { amount: 5000, classification: 'REC', considered: true, description: 'PIX EMPRESA XYZ LTDA', personType: 'PESSOA_JURIDICA' },
    ]);
    expect(r.perfil).toBe('recorrente-pj');
  });

  it('renda recorrente só de pessoa física classifica como variavel', () => {
    const r = classifyPerfilRenda([
      { amount: 800, classification: 'PIX', considered: true, description: 'PIX JOAO DA SILVA', personType: 'PESSOA_NATURAL' },
    ]);
    expect(r.perfil).toBe('variavel');
  });

  it('sem créditos recorrentes classifica como indeterminado', () => {
    expect(classifyPerfilRenda(null).perfil).toBe('indeterminado');
    expect(classifyPerfilRenda([
      { amount: 900, classification: 'NREC', considered: false, description: 'VENDA AVULSA', personType: 'PESSOA_NATURAL' },
    ]).perfil).toBe('indeterminado');
  });

  it('linhas não recorrentes não influenciam a classificação', () => {
    const r = classifyPerfilRenda([
      { amount: 800, classification: 'PIX', considered: true, description: 'PIX JOAO DA SILVA', personType: 'PESSOA_NATURAL' },
      { amount: 9000, classification: 'NREC', considered: false, description: 'SALARIO EMPRESA XYZ', personType: 'PESSOA_JURIDICA' },
    ]);
    expect(r.perfil).toBe('variavel');
  });
});

describe('statementWindow', () => {
  it('cobre os 12 meses completos mais o mês corrente parcial', () => {
    expect(statementWindow(new Date(2026, 6, 17))).toEqual({ from: '2025-07', to: '2026-07' });
  });

  it('vira o ano corretamente', () => {
    expect(statementWindow(new Date(2026, 0, 5))).toEqual({ from: '2025-01', to: '2026-01' });
  });
});

describe('isMesCorrente', () => {
  it('reconhece o mês corrente e rejeita meses fechados ou ausentes', () => {
    const now = new Date(2026, 6, 17);
    expect(isMesCorrente('2026-07', now)).toBe(true);
    expect(isMesCorrente('2026-06', now)).toBe(false);
    expect(isMesCorrente(undefined, now)).toBe(false);
  });
});

describe('mês corrente parcial na composição', () => {
  const now = new Date();
  const ymCorrente = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  it('mapMonth marca o mês corrente como parcial', () => {
    expect(mapMonth({ yearMonth: ymCorrente, totalCredits: 10 }).parcial).toBe(true);
    expect(mapMonth({ yearMonth: '2020-01', totalCredits: 10 }).parcial).toBe(false);
  });

  it('computeRendaStats ignora o mês corrente parcial', () => {
    const base = { months: [{ yearMonth: '2025-01', validatedIncome: 100 }], summary: { monthsAnalyzed: 1 } };
    const comParcial = {
      months: [...base.months, { yearMonth: ymCorrente, validatedIncome: 9999 }],
      summary: { monthsAnalyzed: 1 },
    };
    expect(computeRendaStats(comParcial)).toEqual(computeRendaStats(base));
  });
});
