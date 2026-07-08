/**
 * useCaseEvidence.js — hook que carrega as evidências Open Finance de um caso
 * (insights, composição de renda, extrato 12m e links) a partir da API, além de
 * helpers puros para normalizar bancos e derivar instituições/contas dessas
 * evidências. Quando a coleta revela novas instituições, sincroniza os bancos
 * do caso via callback de atualização.
 */

import React from 'react';
import { clientsApi } from '../services/api';
import { resolveClientForCase } from '../services/clientResolution.js';

export function normalizeBankLabel(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/[A-Za-zÀ-ÿ]/.test(raw)) return '';
  const lower = raw.toLowerCase();
  if (lower.includes('open finance') || lower.includes('akropoli')) return '';
  if (lower.includes('itau') || lower.includes('itaú')) return 'Itau';
  if (lower.includes('bradesco')) return 'Bradesco';
  if (lower.includes('nubank') || lower.includes('nu ')) return 'Nubank';
  if (lower.includes('santander')) return 'Santander';
  if (lower.includes('caixa')) return 'Caixa';
  if (lower.includes('banco do brasil')) return 'Banco do Brasil';
  if (lower === 'inter' || lower.includes('banco inter')) return 'Inter';
  if (lower.includes('mercado pago')) return 'Mercado Pago';
  return raw.split(/[|/,-]/)[0].trim();
}

export function getLocalBankLabels(caseItem) {
  return Array.from(new Set((caseItem.banks || []).map(normalizeBankLabel).filter(Boolean)));
}

function haveSameBankLabels(current = [], next = []) {
  if (current.length !== next.length) return false;
  const currentSet = new Set(current);
  return next.every((label) => currentSet.has(label));
}

function getFieldCandidates(row) {
  return [
    row?.bank,
    row?.bankName,
    row?.institution,
    row?.institutionName,
    row?.financialInstitution,
    row?.brandName,
    row?.account,
    row?.accountName,
    row?.origin,
  ];
}

function getLinkCandidates(link) {
  return [
    link?.bank,
    link?.bankName,
    link?.institution,
    link?.institutionName,
    link?.brandName,
    link?.provider,
  ];
}

export function deriveInstitutions(caseItem, evidence) {
  const names = new Set();
  const rows = evidence?.statement?.rows || [];
  rows.forEach((row) => {
    getFieldCandidates(row).forEach((value) => {
      const label = normalizeBankLabel(value);
      if (label) names.add(label);
    });
  });

  if (names.size === 0 && Array.isArray(evidence?.links)) {
    evidence.links.forEach((link) => {
      getLinkCandidates(link).forEach((value) => {
        const label = normalizeBankLabel(value);
        if (label) names.add(label);
      });
    });
  }

  if (names.size === 0) {
    (caseItem.banks || []).forEach((value) => {
      const label = normalizeBankLabel(value);
      if (label) names.add(label);
    });
  }

  return Array.from(names);
}

export function getAccountTags(caseItem) {
  const banks = getLocalBankLabels(caseItem);
  return banks.map((bank, index) => {
    if (caseItem.status === 'semRenda') return { bank, label: 'Sem renda', tone: 'danger' };
    if (caseItem.status === 'maisContas') return { bank, label: index === 0 ? 'Conta de apoio' : 'Sem renda', tone: 'warning' };
    return { bank, label: index === 0 ? 'Recebe renda' : 'Conta de apoio', tone: index === 0 ? 'success' : 'neutral' };
  });
}

export function deriveAccountTags(caseItem, evidence) {
  const rows = evidence?.statement?.rows || [];
  const byBank = new Map();

  rows.forEach((row) => {
    const bank = getFieldCandidates(row).map(normalizeBankLabel).find(Boolean);
    if (!bank) return;
    const current = byBank.get(bank) || { bank, label: 'Conta considerada', tone: 'neutral', credits: 0 };
    if (row.inflow != null || row.type === 'CREDIT') current.credits += 1;
    byBank.set(bank, current);
  });

  const items = Array.from(byBank.values()).map((item, index) => ({
    bank: item.bank,
    label: item.credits > 0 || index === 0 ? 'Recebe renda' : 'Conta de apoio',
    tone: item.credits > 0 || index === 0 ? 'success' : 'neutral',
  }));

  if (items.length) return items;

  if (Array.isArray(evidence?.links)) {
    const linkedBanks = new Set();
    evidence.links.forEach((link) => {
      getLinkCandidates(link).forEach((value) => {
        const label = normalizeBankLabel(value);
        if (label) linkedBanks.add(label);
      });
    });

    if (linkedBanks.size) {
      return Array.from(linkedBanks).map((bank) => ({
        bank,
        label: 'Conta conectada',
        tone: 'neutral',
      }));
    }
  }

  return getAccountTags(caseItem);
}

const INITIAL_EVIDENCE_STATE = {
  loading: true,
  client: null,
  id: null,
  insights: null,
  income: null,
  statement: null,
  links: [],
  error: '',
};

export function useCaseEvidence(caseItem, onUpdateCase) {
  const [evidenceState, setEvidenceState] = React.useState(INITIAL_EVIDENCE_STATE);
  const onUpdateCaseRef = React.useRef(onUpdateCase);

  React.useEffect(() => {
    onUpdateCaseRef.current = onUpdateCase;
  });

  React.useEffect(() => {
    let cancelled = false;

    async function loadEvidence() {
      setEvidenceState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const { client, id } = await resolveClientForCase(caseItem);
        const [insights, income, statement, linksResult] = await Promise.all([
          clientsApi.getInsights(id),
          clientsApi.getIncomeComposition(id, { months: 12 }),
          clientsApi.getStatement(id, { months: 12 }),
          clientsApi.getLinks(id).catch(() => []),
        ]);
        if (cancelled) return;
        const links = Array.isArray(linksResult) ? linksResult : linksResult?.content || [];
        const evidencePayload = { client, id, insights, income, statement, links, error: '' };
        const derivedBanks = deriveInstitutions(caseItem, evidencePayload);
        const currentBanks = getLocalBankLabels(caseItem);
        if (derivedBanks.length && !haveSameBankLabels(currentBanks, derivedBanks)) {
          onUpdateCaseRef.current?.(caseItem.id, {
            banks: derivedBanks,
            updatedAtLabel: caseItem.updatedAtLabel,
          });
        }
        setEvidenceState({
          loading: false,
          client,
          id,
          insights,
          income,
          statement,
          links,
          error: '',
        });
      } catch (error) {
        if (cancelled) return;
        setEvidenceState({
          loading: false,
          client: null,
          id: null,
          insights: null,
          income: null,
          statement: null,
          links: [],
          error: error.code === 'ambiguous' ? error.message : 'Cliente/evidencias nao localizados na API.',
        });
      }
    }

    loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [caseItem.id, caseItem.clientId, caseItem.cpf, caseItem.email, caseItem.name]);

  return evidenceState;
}
