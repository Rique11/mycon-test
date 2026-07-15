/**
 * useCaseEvidence.js — hook que carrega as evidências Open Finance de um caso
 * (insights, composição de renda, extrato 12m e links) a partir da API, além de
 * helpers puros para normalizar bancos e derivar instituições/contas dessas
 * evidências. Se o cliente tem conexão ativa mas nunca foi sincronizado, dispara
 * a coleta inicial (sync) antes de buscar composição, extrato e links, para que
 * as evidências reflitam os dados coletados. Quando a coleta revela novas
 * instituições, sincroniza os bancos do caso via callback de atualização.
 */

import React from 'react';
import { clientsApi } from '../services/api';
import { ensureClientSynced } from '../services/clientSync';
import { resolveClientForCase } from '../services/clientResolution.js';

// IDs opacos (linkId ULID, hash sha256/512, UUID) que às vezes aparecem nos
// campos de banco/instituição quando a API não traz um nome legível. Nunca
// devem ser exibidos como se fossem o nome do banco.
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_TOKEN_RE = /^[0-9a-f]{20,}$/i;

function isOpaqueToken(value) {
  const raw = String(value || '').trim();
  if (!raw || /\s/.test(raw)) return false;
  if (ULID_RE.test(raw) || UUID_RE.test(raw) || HEX_TOKEN_RE.test(raw)) return true;
  return raw.length >= 20 && /^[0-9A-Za-z]+$/.test(raw);
}

function truncateToken(value, max = 18) {
  const raw = String(value || '');
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

export function normalizeBankLabel(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/[A-Za-zÀ-ÿ]/.test(raw)) return '';
  if (isOpaqueToken(raw)) return '';
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

// Reúne os tokens brutos disponíveis (linhas do extrato, depois links, depois
// os bancos já salvos no caso) seguindo a mesma prioridade de fonte usada
// para resolver nomes, para servir de base ao rótulo genérico numerado
// quando nenhum nome de instituição confiável é identificado.
function collectCandidateTokens(caseItem, evidence) {
  const rowTokens = [];
  const rows = evidence?.statement?.rows || [];
  rows.forEach((row) => {
    getFieldCandidates(row).forEach((value) => {
      const raw = String(value || '').trim();
      if (raw) rowTokens.push(raw);
    });
  });
  if (rowTokens.length) return rowTokens;

  const linkTokens = [];
  if (Array.isArray(evidence?.links)) {
    evidence.links.forEach((link) => {
      getLinkCandidates(link).forEach((value) => {
        const raw = String(value || '').trim();
        if (raw) linkTokens.push(raw);
      });
    });
  }
  if (linkTokens.length) return linkTokens;

  return (caseItem.banks || []).map((value) => String(value || '').trim()).filter(Boolean);
}

function genericInstitutionLabels(caseItem, evidence) {
  const seen = new Set();
  const opaque = [];
  collectCandidateTokens(caseItem, evidence).forEach((raw) => {
    if (seen.has(raw) || !isOpaqueToken(raw)) return;
    seen.add(raw);
    opaque.push(raw);
  });
  return opaque.map((token, index) => `Instituição ${index + 1} (${truncateToken(token)})`);
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

  if (names.size > 0) return Array.from(names);

  // Nenhum nome de instituição confiável identificado — apenas identificadores
  // opacos (linkId/hash). Em vez de expor o token bruto, mostra a quantidade
  // de instituições distintas com um rótulo genérico numerado.
  return genericInstitutionLabels(caseItem, evidence);
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

  const localTags = getAccountTags(caseItem);
  if (localTags.length) return localTags;

  // Mesmo fallback genérico de deriveInstitutions, para que o rótulo de cada
  // conta bata com a contagem exibida em "Instituições conectadas".
  return genericInstitutionLabels(caseItem, evidence).map((bank) => ({
    bank,
    label: 'Conta considerada',
    tone: 'neutral',
  }));
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
    const controller = new AbortController();

    async function loadEvidence() {
      setEvidenceState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const { client, id } = await resolveClientForCase(caseItem);
        const initialInsights = await clientsApi.getInsights(id, controller.signal);
        const insights = await ensureClientSynced(id, client, initialInsights, controller.signal);
        const [income, statement, linksResult] = await Promise.all([
          clientsApi.getIncomeComposition(id, { months: 12 }, controller.signal),
          clientsApi.getStatement(id, { months: 12 }, controller.signal),
          clientsApi.getLinks(id, controller.signal).catch(() => []),
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
      controller.abort();
    };
  }, [caseItem.id, caseItem.clientId, caseItem.cpf, caseItem.email, caseItem.name]);

  return evidenceState;
}
