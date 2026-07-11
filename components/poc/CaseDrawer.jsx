/**
 * CaseDrawer.jsx — drawer lateral com o detalhe operacional de um caso da POC:
 * dados do contemplado, status do consentimento, coleta Open Finance, extrato e
 * evidências, pendências estruturadas, histórico e exportações (Excel/PDF).
 */

import React from 'react';
import { TOKENS, I, SHADOWS } from '../../tokens.js';
import Icon from '../Icon.jsx';
import Badge from '../Badge.jsx';
import Button from '../Button.jsx';
import StepNumber from '../StepNumber.jsx';
import EvidKpi from '../EvidKpi.jsx';
import { clientsApi } from '../../services/api';
import { exportConsolidado } from '../../services/exportExcel.js';
import { exportExtratoPdf } from '../../services/exportPdf.js';
import { PRODUCT_LABELS, getQueueBusinessRules, getStatusMeta, computeReceitaStats } from '../../services/domain';
import { maskCpf, fmtBRL } from '../../lib/format';
import { resolveClientForCase } from '../../services/clientResolution.js';
import { useCaseEvidence, deriveAccountTags, deriveInstitutions } from '../../hooks/useCaseEvidence.js';

function formatDate(value) {
  if (!value) return '-';
  try {
    const [year, month, day] = value.split('-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && year && month && day) return `${day}/${month}/${year}`;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (year && month && day) return `${day}/${month}/${year}`;
    return value;
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return '-';
  try {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    return value;
  }
  return value;
}

function getCaseEvents(caseItem) {
  if (Array.isArray(caseItem.events) && caseItem.events.length) return caseItem.events;

  const meta = getStatusMeta(caseItem.status);
  return [
    { at: caseItem.createdAt, label: 'Caso carregado a partir do mock da POC', actor: 'Lizard' },
    { at: caseItem.createdAt, label: meta.label, actor: meta.owner || 'Operação' },
  ];
}

function appendCaseEvent(caseItem, label, actor = 'Lizard') {
  return [
    ...(Array.isArray(caseItem.events) ? caseItem.events : getCaseEvents(caseItem)),
    { at: new Date().toISOString(), label, actor },
  ];
}

function getConsentInfo(caseItem) {
  const hasLink = Boolean(caseItem.consentLink);
  const consentId = caseItem.consent?.id
    || caseItem.consent?.consentId
    || caseItem.consent?.linkId
    || caseItem.consent?.uuid
    || (caseItem.clientId ? `CLIENTE-${caseItem.clientId}` : null);

  if (caseItem.status === 'expirado') {
    return {
      label: 'Expirado',
      tone: 'danger',
      validity: 'Expirado',
      linkLabel: hasLink ? 'Link anterior armazenado' : 'Link expirado ou nao armazenado',
      id: consentId || 'Nao informado',
    };
  }

  if (['conectado', 'maisContas', 'semRenda', 'pronto'].includes(caseItem.status)) {
    return {
      label: 'Autorizado',
      tone: 'success',
      validity: caseItem.consentExpiresAt ? formatDate(caseItem.consentExpiresAt) : 'Autorizacao vigente na POC',
      linkLabel: hasLink ? 'Link armazenado' : 'Autorizacao registrada sem link local',
      id: consentId || 'Nao informado',
    };
  }

  if (['enviado', 'aguardando'].includes(caseItem.status)) {
    return {
      label: caseItem.status === 'enviado' ? 'Enviado' : 'Aguardando cliente',
      tone: 'warning',
      validity: caseItem.consentExpiresAt ? formatDate(caseItem.consentExpiresAt) : '—',
      linkLabel: hasLink ? 'Disponivel para copiar' : 'Nao armazenado nesta linha',
      id: consentId || 'Nao informado',
    };
  }

  return {
    label: 'Fora do fluxo OF',
    tone: 'neutral',
    validity: caseItem.consentExpiresAt ? formatDate(caseItem.consentExpiresAt) : 'Nao aplicavel',
    linkLabel: hasLink ? 'Disponivel para copiar' : 'Nao armazenado nesta linha',
    id: consentId || 'Nao informado',
  };
}

function getCollectionInfo(caseItem) {
  if (caseItem.status === 'pronto') {
    return {
      label: 'Concluida',
      tone: 'success',
      period: '12 meses',
      description: 'Coleta concluida e pacote operacional disponivel.',
    };
  }

  if (['conectado', 'maisContas', 'semRenda'].includes(caseItem.status)) {
    return {
      label: caseItem.status === 'conectado' ? 'Em andamento' : 'Em andamento com pendencia',
      tone: caseItem.status === 'conectado' ? 'purple' : 'warning',
      period: '12 meses',
      description: 'Open Finance autorizado. A disponibilidade do pacote depende da coleta e das pendencias.',
    };
  }

  if (caseItem.status === 'manual') {
    return {
      label: 'Fluxo manual',
      tone: 'neutral',
      period: '12 meses',
      description: 'Caso encaminhado para coleta manual por PDF/documentos.',
    };
  }

  return {
    label: 'Nao iniciada',
    tone: caseItem.status === 'expirado' ? 'danger' : 'neutral',
    period: '12 meses',
    description: 'A coleta so comeca depois do consentimento Open Finance autorizado.',
  };
}

function getOutputInfo(caseItem, meta) {
  if (caseItem.status === 'pronto') {
    return {
      label: 'Pronto',
      tone: 'success',
      message: 'Extrato 12m e Excel consolidado disponiveis para revisao operacional.',
      generatedAt: caseItem.outputGeneratedAt || caseItem.updatedAtLabel || 'Gerado no mock da POC',
    };
  }

  if (caseItem.status === 'conectado') {
    return {
      label: 'Em coleta',
      tone: 'purple',
      message: 'Open Finance conectado, mas o pacote 12m ainda nao esta pronto.',
      generatedAt: null,
    };
  }

  return {
    label: meta.statement || 'Aguardando',
    tone: meta.tone,
    message: meta.pending || 'Sem pacote de extrato disponivel neste status.',
    generatedAt: null,
  };
}

function hasStatementRows(statement) {
  return Array.isArray(statement?.rows) && statement.rows.length > 0;
}

function hasIncomeEvidence(income) {
  return Array.isArray(income?.months) && income.months.length > 0;
}

function hasReadyEvidence(evidence) {
  return hasStatementRows(evidence?.statement) || hasIncomeEvidence(evidence?.income);
}

function getEvidenceHash(caseItem, evidence) {
  return evidence?.statement?.hash
    || evidence?.statement?.evidenceHash
    || evidence?.income?.hash
    || evidence?.income?.evidenceHash
    || caseItem.evidenceHash
    || '—';
}

function getPeriodLabel(statement, income) {
  const from = statement?.fromYearMonth || income?.fromYearMonth;
  const to = statement?.toYearMonth || income?.toYearMonth;
  if (from && to) return `${from} a ${to}`;
  return '12 meses';
}

function getEffectiveMeta(caseItem, meta, evidence) {
  if (hasReadyEvidence(evidence)) {
    return {
      ...meta,
      statement: 'Pronto',
      pending: null,
    };
  }
  return meta;
}

function getEffectiveCollectionInfo(caseItem, evidence) {
  if (hasReadyEvidence(evidence)) {
    return {
      label: 'Concluida',
      tone: 'success',
      period: getPeriodLabel(evidence?.statement, evidence?.income),
      description: 'Open Finance sincronizado; extrato e composicao de renda ja disponiveis para exportacao.',
    };
  }
  return getCollectionInfo(caseItem);
}

function getEffectiveOutputInfo(caseItem, meta, evidence, loading) {
  if (loading) {
    return {
      label: 'Verificando',
      tone: 'blue',
      message: 'Buscando evidencias do cliente na API para confirmar disponibilidade do pacote 12m.',
      generatedAt: null,
    };
  }

  if (hasReadyEvidence(evidence)) {
    return {
      label: 'Pronto',
      tone: 'success',
      message: 'Extrato 12m e Excel consolidado disponiveis para revisao operacional.',
      generatedAt: evidence?.insights?.lastSyncAt
        ? new Date(evidence.insights.lastSyncAt).toLocaleString('pt-BR')
        : caseItem.updatedAtLabel || 'Gerado a partir das evidencias Open Finance',
    };
  }

  return getOutputInfo(caseItem, meta);
}

function hasStructuredPending(caseItem, meta) {
  return ['enviado', 'aguardando', 'maisContas', 'semRenda', 'expirado', 'escalado', 'manual'].includes(caseItem.status)
    || (Boolean(meta.pending) && caseItem.status !== 'conectado');
}

function buildCaseClient(caseItem) {
  return {
    id: caseItem.clientId || caseItem.externalCaseId,
    name: caseItem.name,
    cpf: caseItem.cpf,
    email: caseItem.email,
    active: true,
    akropoliLinkId: caseItem.consent?.linkId || caseItem.consent?.id || null,
  };
}

function emptyOutputPayload(caseItem) {
  const today = new Date();
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return {
    insights: {
      incomeDetected: caseItem.status === 'pronto',
      lastSyncAt: today.toISOString(),
    },
    income: {
      fromYearMonth: yearMonth,
      toYearMonth: yearMonth,
      months: [],
      detail: [],
    },
    statement: {
      fromYearMonth: yearMonth,
      toYearMonth: yearMonth,
      rows: [],
    },
  };
}

async function copyText(value) {
  if (!value) return false;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(input);
  return copied;
}

export default function CaseDrawer({ caseItem, onClose, onSelectClient, onUpdateCase }) {
  const baseMeta = getStatusMeta(caseItem.status);
  const events = getCaseEvents(caseItem);
  const consent = getConsentInfo(caseItem);
  const [openingClient, setOpeningClient] = React.useState(false);
  const [openClientError, setOpenClientError] = React.useState('');
  const [drawerMessage, setDrawerMessage] = React.useState('');
  const [copyLabel, setCopyLabel] = React.useState('Copiar');
  const [generatingLink, setGeneratingLink] = React.useState(false);
  const [exporting, setExporting] = React.useState('');
  const messageTimerRef = React.useRef(null);
  const copyTimerRef = React.useRef(null);
  const evidenceState = useCaseEvidence(caseItem, onUpdateCase);

  const evidence = evidenceState.loading ? null : evidenceState;
  const outputsReady = hasReadyEvidence(evidence);
  const queueRule = getQueueBusinessRules(caseItem, { evidenceReady: outputsReady });
  const meta = {
    ...baseMeta,
    label: queueRule.statusLabel,
    tone: queueRule.tone,
    owner: queueRule.owner,
    nextAction: queueRule.nextAction,
    pending: outputsReady ? null : baseMeta.pending,
  };
  const effectiveMeta = getEffectiveMeta(caseItem, meta, evidence);
  const collection = getEffectiveCollectionInfo(caseItem, evidence);
  const output = getEffectiveOutputInfo(caseItem, meta, evidence, evidenceState.loading);
  const evidenceHash = getEvidenceHash(caseItem, evidence);
  const receita = React.useMemo(() => computeReceitaStats(evidence?.income), [evidence]);
  const accountTags = React.useMemo(() => deriveAccountTags(caseItem, evidence), [caseItem, evidence]);
  const institutions = React.useMemo(() => deriveInstitutions(caseItem, evidence), [caseItem, evidence]);

  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  React.useEffect(() => () => {
    window.clearTimeout(messageTimerRef.current);
    window.clearTimeout(copyTimerRef.current);
  }, []);

  function showMessage(message) {
    setDrawerMessage(message);
    window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => setDrawerMessage(''), 2800);
  }

  function resetCopyLabel() {
    window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyLabel('Copiar'), 1800);
  }

  async function getRealOrFallbackClient() {
    if (evidenceState.id && evidenceState.client) {
      return { client: evidenceState.client, id: evidenceState.id, fallback: false };
    }

    try {
      const { client, id } = await resolveClientForCase(caseItem);
      return { client, id, fallback: false };
    } catch (error) {
      if (error.code === 'ambiguous') throw error;
      return { client: buildCaseClient(caseItem), id: null, fallback: true };
    }
  }

  async function handleOpenClient() {
    setOpeningClient(true);
    setOpenClientError('');
    try {
      const { id: resolvedId } = await resolveClientForCase(caseItem);
      onSelectClient?.(resolvedId);
      return;
    } catch (error) {
      setOpenClientError(error.code === 'ambiguous'
        ? error.message
        : 'Cliente nao encontrado na aba Clientes.');
    } finally {
      setOpeningClient(false);
    }
  }

  async function handleCopyLink() {
    if (!caseItem.consentLink) {
      setCopyLabel('Sem link');
      resetCopyLabel();
      return;
    }

    try {
      await copyText(caseItem.consentLink);
      setCopyLabel('Copiado');
      onUpdateCase?.(caseItem.id, {
        events: appendCaseEvent(caseItem, 'Link de consentimento copiado no drawer', 'Operacao'),
      });
    } catch {
      setCopyLabel('Falhou');
    } finally {
      resetCopyLabel();
    }
  }

  async function handleGenerateNewLink() {
    setGeneratingLink(true);
    setDrawerMessage('');
    try {
      const { id, fallback } = await getRealOrFallbackClient();
      if (fallback || !id) {
        showMessage('Cliente nao encontrado na aba Clientes para gerar novo link real.');
        return;
      }

      const result = await clientsApi.getConsentLink(id);
      const consentLink = result?.consentLink || result?.url || result?.link || '';
      const now = new Date();
      const expiresAt = result?.expiresAt
        || result?.consentExpiresAt
        || result?.consent?.expiresAt
        || null;
      onUpdateCase?.(caseItem.id, {
        status: 'enviado',
        consentLink,
        consent: result?.consent || caseItem.consent,
        consentCreatedAt: now.toISOString(),
        consentExpiresAt: expiresAt,
        events: appendCaseEvent(caseItem, 'Novo link de consentimento gerado', 'Akropoli'),
      });
      if (consentLink) await copyText(consentLink);
      showMessage(consentLink ? 'Novo link gerado e copiado.' : 'Novo convite gerado, mas a API nao retornou link.');
    } catch {
      showMessage('Nao foi possivel gerar novo link agora.');
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleExportExcel() {
    setExporting('excel');
    setDrawerMessage('');
    try {
      const { client, id, fallback } = await getRealOrFallbackClient();
      let payload = {
        insights: evidenceState.insights,
        income: evidenceState.income,
        statement: evidenceState.statement,
      };
      if ((!payload.statement || !payload.income || !payload.insights) && !fallback && id) {
        const [insights, income, statement] = await Promise.all([
          clientsApi.getInsights(id),
          clientsApi.getIncomeComposition(id, { months: 12 }),
          clientsApi.getStatement(id, { months: 12 }),
        ]);
        payload = { insights, income, statement };
      }
      let dataStatus = fallback ? 'demo' : 'real';
      if (!payload.statement && !payload.income && !payload.insights) {
        payload = emptyOutputPayload(caseItem);
        dataStatus = fallback ? 'demo' : 'empty';
      }
      await exportConsolidado({ client, caseItem, dataStatus, ...payload });
      onUpdateCase?.(caseItem.id, {
        events: appendCaseEvent(caseItem, 'Excel consolidado exportado pelo drawer', 'Lizard'),
      });
      if (dataStatus !== 'real') {
        showMessage(dataStatus === 'demo'
          ? 'Excel demonstrativo exportado com dados do caso; cliente real nao foi localizado.'
          : 'Excel exportado, mas o cliente real nao possui dados de Open Finance ainda.');
      }
    } catch (error) {
      showMessage(error.code === 'ambiguous'
        ? error.message
        : 'Nao foi possivel exportar o Excel agora.');
    } finally {
      setExporting('');
    }
  }

  async function handleExportPdf() {
    setExporting('pdf');
    setDrawerMessage('');
    try {
      const { client, id, fallback } = await getRealOrFallbackClient();
      let statement = evidenceState.statement;
      if (!fallback && id) {
        statement = statement || await clientsApi.getStatement(id, { months: 12 });
      }
      if (!statement) statement = emptyOutputPayload(caseItem).statement;
      exportExtratoPdf(client, statement);
      onUpdateCase?.(caseItem.id, {
        events: appendCaseEvent(caseItem, 'Extrato 12m em PDF exportado pelo drawer', 'Lizard'),
      });
      if (fallback) showMessage('PDF demonstrativo exportado com dados do caso; cliente real nao foi localizado.');
    } catch (error) {
      showMessage(error.code === 'ambiguous'
        ? error.message
        : 'Nao foi possivel exportar o PDF agora.');
    } finally {
      setExporting('');
    }
  }

  return (
    <div className="lz-anim-fade" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 40,
      background: 'rgba(16,26,51,.18)',
      display: 'flex',
      justifyContent: 'flex-end',
    }}>
      <aside className="lz-anim-panel" style={{
        width: 'min(640px, 100vw)',
        height: '100%',
        background: TOKENS.surface,
        borderLeft: `1px solid ${TOKENS.border}`,
        boxShadow: SHADOWS.slideOver,
        display: 'flex',
        flexDirection: 'column',
      }} role="dialog" aria-modal="true" aria-labelledby="case-drawer-title">
        <div style={{ padding: 20, borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="num" style={{ color: TOKENS.primary, fontWeight: 800, fontSize: 12, marginBottom: 7 }}>{caseItem.externalCaseId}</div>
            <h2 id="case-drawer-title" style={{ margin: 0, color: TOKENS.title, fontSize: 19, letterSpacing: -0.2 }}>{caseItem.name}</h2>
            <p style={{ margin: '6px 0 0', color: TOKENS.textMuted, fontSize: 12.8 }}>
              {PRODUCT_LABELS[caseItem.product]} - Grupo {caseItem.group} / Cota {caseItem.quota}
            </p>
          </div>
          <button className="lz-btn-ghost" onClick={onClose} style={{ width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={I.x} size={16} stroke={TOKENS.textMuted} strokeWidth={2} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <section style={{ marginBottom: 18 }}>
            <Badge tone={effectiveMeta.tone} size="md" dot>{effectiveMeta.label}</Badge>
            <p style={{ margin: '10px 0 0', color: TOKENS.text, fontSize: 13.2, lineHeight: 1.5 }}>
              {effectiveMeta.nextAction}
            </p>
            <div style={{ marginTop: 10 }}>
              <InfoLine label="Responsavel agora" value={effectiveMeta.owner || '-'} />
            </div>
          </section>

          <DrawerSection number={1} title="Dados do contemplado">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <DrawerField label="CPF" value={caseItem.cpfMasked || maskCpf(caseItem.cpf)} mono />
              <DrawerField label="Celular / WhatsApp" value={caseItem.phone || '-'} mono />
              <DrawerField label="E-mail" value={caseItem.email || '-'} />
              <DrawerField label="Produto" value={PRODUCT_LABELS[caseItem.product] || '-'} />
              <DrawerField label="Grupo / Cota" value={`${caseItem.group || '-'} / ${caseItem.quota || '-'}`} mono />
              <DrawerField label="Valor da carta" value={caseItem.letterValue || '-'} mono />
            <DrawerField label="Contemplação" value={formatDate(caseItem.contemplationDate)} />
              {consent.tone === 'success' && (
                <>
                  <EvidKpi label="Receita anual" value={receita.media12m != null ? fmtBRL(receita.media12m) : '—'} sub="Média mensal (12m)" mono
                    info="Média mensal das entradas totais no período analisado (até 12 meses)." />
                  <EvidKpi label="Volatilidade"
                    value={receita.volatilidade != null ? `${(receita.volatilidade * 100).toFixed(0)}%` : '—'}
                    sub={receita.volatilidade == null ? 'Sem dado no período'
                      : receita.volatilidade <= 0.25 ? 'Oscilação baixa'
                      : receita.volatilidade <= 0.5 ? 'Oscilação moderada'
                      : 'Oscilação alta'}
                    mono
                    info="Quanto a receita mensal (entradas totais) oscilou no período analisado: desvio padrão dividido pela média (coeficiente de variação). Quanto maior o percentual, mais instável a receita." />
                </>
              )}
            </div>
          </DrawerSection>

          <DrawerSection number={2} title="Status do consentimento" background={TOKENS.panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <Badge tone={consent.tone} dot>{consent.label}</Badge>
              {caseItem.consentLink && (
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Icon d={I.link} size={14} stroke="currentColor" strokeWidth={1.9} />
                  {copyLabel}
                </Button>
              )}
            </div>
            {caseItem.status === 'expirado' && (
              <div style={{ marginTop: 12 }}>
                <Button variant="secondary" size="sm" onClick={handleGenerateNewLink} disabled={generatingLink}>
                  <Icon d={I.refresh} size={14} stroke="currentColor" strokeWidth={1.9} />
                  {generatingLink ? 'Gerando...' : 'Gerar novo link'}
                </Button>
              </div>
            )}
          </DrawerSection>

          <DrawerSection number={3} title="Coleta Open Finance">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <Badge tone={collection.tone} dot>{collection.label}</Badge>
              <span style={{ color: TOKENS.textMuted, fontSize: 12.4 }}>Periodo: {collection.period}</span>
            </div>
            <p style={{ margin: '0 0 12px', color: TOKENS.textMuted, fontSize: 12.8, lineHeight: 1.45 }}>{collection.description}</p>
            <InfoLine label="Instituicoes conectadas" value={institutions.length ? institutions.join(', ') : 'Nenhuma instituicao identificada'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {accountTags.length
                ? accountTags.map((item) => <AccountTag key={`${item.bank}-${item.label}`} {...item} />)
                : <span style={{ color: TOKENS.textSubtle, fontSize: 12.5 }}>Nenhuma conta considerada ate o momento.</span>}
            </div>
          </DrawerSection>

          <DrawerSection number={4} title="Extrato e evidencias" background={TOKENS.panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <Badge tone={output.tone} dot>{output.label}</Badge>
              <span className="num" style={{ color: TOKENS.textSubtle, fontSize: 11.5 }}>{evidenceHash}</span>
            </div>
            <p style={{ margin: '0 0 10px', color: TOKENS.textMuted, fontSize: 12.8, lineHeight: 1.45 }}>{output.message}</p>
            {output.generatedAt && <InfoLine label="Geracao" value={output.generatedAt} />}
            {outputsReady && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={Boolean(exporting)}>
                  <Icon d={I.doc} size={14} stroke="currentColor" strokeWidth={1.9} />
                  {exporting === 'pdf' ? 'Exportando...' : 'Baixar extrato 12m'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={Boolean(exporting)}>
                  <Icon d={I.download} size={14} stroke="currentColor" strokeWidth={1.9} />
                  {exporting === 'excel' ? 'Exportando...' : 'Excel consolidado'}
                </Button>
              </div>
            )}
          </DrawerSection>

          {hasStructuredPending(caseItem, effectiveMeta) && (
            <DrawerSection title="Pendencias e excecoes">
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 28, height: 28, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', color: TOKENS.danger, flexShrink: 0 }}>
                  <Icon d={I.alert} size={15} stroke="currentColor" strokeWidth={1.9} />
                </span>
                <p style={{ margin: 0, color: TOKENS.text, fontSize: 12.9, lineHeight: 1.5 }}>
                  {effectiveMeta.pending || 'Caso sem pendencia bloqueante registrada.'} {effectiveMeta.nextAction}
                </p>
              </div>
            </DrawerSection>
          )}

          {caseItem.notes && (
            <section style={{ padding: 14, border: `1px solid ${TOKENS.border}`, borderRadius: 12, marginBottom: 14 }}>
              <h3 style={{ margin: '0 0 8px', color: TOKENS.title, fontSize: 14 }}>Observações internas</h3>
              <p style={{ margin: 0, color: TOKENS.textMuted, fontSize: 12.8, lineHeight: 1.5 }}>{caseItem.notes}</p>
            </section>
          )}

          <section style={{ padding: 14, border: `1px solid ${TOKENS.border}`, borderRadius: 12, background: TOKENS.surface }}>
            <h3 style={{ margin: '0 0 10px', color: TOKENS.title, fontSize: 14 }}>Histórico operacional</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map((event, index) => (
                <div key={`${event.label}-${index}`} style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: 10 }}>
                  <span style={{ color: TOKENS.textSubtle, fontSize: 11.2 }}>{formatDateTime(event.at)}</span>
                  <span style={{ color: TOKENS.text, fontSize: 12.5, lineHeight: 1.4 }}>
                    <strong style={{ fontWeight: 750 }}>{event.actor || 'Operação'}:</strong> {event.label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div style={{ padding: 16, borderTop: `1px solid ${TOKENS.border}`, display: 'flex', gap: 10 }}>
          <Button variant="outline" style={{ flex: 1 }} onClick={onClose}>Voltar a fila</Button>
          <Button
            style={{ flex: 1 }}
            disabled={openingClient}
            onClick={handleOpenClient}
          >
            {openingClient ? 'Abrindo...' : 'Abrir cliente'}
          </Button>
        </div>
        {(openClientError || drawerMessage) && (
          <div style={{ padding: '0 16px 14px', color: openClientError ? TOKENS.danger : TOKENS.textMuted, fontSize: 12.5, fontWeight: 600 }}>
            {openClientError || drawerMessage}
          </div>
        )}
      </aside>
    </div>
  );
}

function DrawerSection({ number, title, children, background = TOKENS.surface }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 10px', color: TOKENS.title, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        {number && <StepNumber n={number} />}
        {title}
      </h3>
      <div style={{ padding: 14, border: `1px solid ${TOKENS.border}`, borderRadius: 12, background }}>
      {children}
      </div>
    </section>
  );
}

function AccountTag({ bank, label, tone }) {
  const colors = {
    success: { bg: '#ECFDF5', color: TOKENS.success, border: '#BBF7D0' },
    warning: { bg: '#FFFBEB', color: TOKENS.warning, border: '#FDE68A' },
    danger: { bg: '#FEF2F2', color: TOKENS.danger, border: '#FECACA' },
    neutral: { bg: TOKENS.panel, color: TOKENS.textMuted, border: TOKENS.border },
  };
  const palette = colors[tone] || colors.neutral;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      border: `1px solid ${TOKENS.border}`,
      background: TOKENS.surface,
      borderRadius: 10,
      padding: '10px 11px',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span className="num" style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: TOKENS.primary,
          color: '#fff',
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
        }}>
          {String(bank || 'OF').slice(0, 2)}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', color: TOKENS.text, fontSize: 13, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bank}
          </span>
          <span style={{ display: 'block', color: TOKENS.textMuted, fontSize: 11.5, marginTop: 2 }}>
            Conta considerada
          </span>
        </span>
      </span>
      <span style={{
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        padding: '4px 8px',
        fontSize: 11.2,
        fontWeight: 750,
        whiteSpace: 'nowrap',
      }}>{label}</span>
    </div>
  );
}

function DrawerField({ label, value, mono }) {
  return (
    <div style={{ padding: '11px 12px', border: `1px solid ${TOKENS.border}`, borderRadius: 10, background: TOKENS.surface }}>
      <div style={{ color: TOKENS.textSubtle, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div className={mono ? 'num' : undefined} style={{ color: TOKENS.text, fontSize: 12.6, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function InfoLine({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.4 }}>
      <span style={{ color: TOKENS.textMuted }}>{label}</span>
      <span className={mono ? 'num' : undefined} style={{ color: TOKENS.text, fontWeight: 650, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
