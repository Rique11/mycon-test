/**
 * domain.test.ts — testes unitários das regras de negócio puras da POC.
 */

import { describe, expect, it } from 'vitest';
import {
  POC_STATUS,
  QUEUE_ACTIONS,
  confTone,
  getQueueBusinessRules,
  getStatusMeta,
  groupDetail,
  isConsentAccepted,
  mapMonth,
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

  it('groupDetail agrupa por classificação e usa nrec como fallback', () => {
    const groups = groupDetail([
      { classification: 'REC', amount: 100, date: '2025-05-01' },
      { classification: 'ATIP', amount: 50, date: '2025-05-02' },
      { classification: 'DESCONHECIDA', amount: 10, date: '2025-05-03' },
    ]);
    expect(groups.rec.items).toHaveLength(1);
    expect(groups.atip.items).toHaveLength(1);
    expect(groups.nrec.items).toHaveLength(1);
    expect(groups.pix.items).toHaveLength(0);
  });

  it('groupDetail aceita lista vazia ou nula', () => {
    const groups = groupDetail(null);
    expect(Object.keys(groups)).toHaveLength(5);
    expect(groups.rec.items).toHaveLength(0);
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
