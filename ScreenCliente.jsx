// Tela de análise do cliente: contexto, resumo visual de KPIs, evidências de
// renda verificada (mediana mensal de pagadores recorrentes calculada pelo
// backend), separada das entradas totais; gráfico de evolução da renda,
// explicação ao operador e recomendação multifator (aprovar / revisar /
// solicitar complemento) derivada dos critérios de aceite da empresa,
// ajustáveis num pop-up ("Definir métricas"). Consome os hooks useClientData e
// useIncomeComposition.

import React from 'react';
import { TOKENS, RADII, SHADOWS, I } from './tokens.js';
import Icon from './components/Icon.jsx';
import Badge from './components/Badge.jsx';
import Card from './components/Card.jsx';
import StepNumber from './components/StepNumber.jsx';
import Avatar from './components/Avatar.jsx';
import Sidebar from './components/Sidebar.jsx';
import AsyncScreen from './components/AsyncScreen.jsx';
import InfoTip from './components/InfoTip.jsx';
import EvidKpi from './components/EvidKpi.jsx';
import { useClientData } from './hooks/useClientData';
import { useIncomeComposition } from './hooks/useIncomeComposition';
import { useLoanInsights } from './hooks/useLoanInsights';
import { useAuth } from './hooks/useAuth';
import { mapMonth, computeRendaStats, computeTendenciaRenda, classifyPerfilRenda, evaluateDecision, sanitizeDecisionCriteria, DEFAULT_DECISION_CRITERIA, PRODUCT_LABELS } from './services/domain';
import { clientsApi } from './services/api';
import { exportConsolidado } from './services/exportExcel.js';
import { exportExtratoPdf } from './services/exportPdf.js';
import { fmtBRL, fmtDate, maskCpf } from './lib/format';

const CRITERIA_STORAGE_KEY = 'mycon_decision_criteria_v1';

const TONE = {
  success: { fg: TOKENS.success, soft: TOKENS.successSoft },
  warning: { fg: TOKENS.warning, soft: TOKENS.warningSoft },
  danger: { fg: TOKENS.danger, soft: TOKENS.dangerSoft },
};

// Aparência de cada nível de recomendação; a decisão em si vem de evaluateDecision.
const DECISION_VIEW = {
  aprovar: {
    label: 'Aprovar comprovação',
    tone: 'success',
    icon: I.shieldCheck,
    tagline: 'Renda recorrente comprovada dentro dos critérios definidos.',
  },
  revisar: {
    label: 'Enviar para revisão manual',
    tone: 'warning',
    icon: I.alert,
    tagline: 'Renda comprovada, mas fora de um ou mais critérios de aceite.',
  },
  complementar: {
    label: 'Solicitar complemento',
    tone: 'danger',
    icon: I.alert,
    tagline: 'Sem renda recorrente comprovável no período.',
  },
};

function loadCriteria() {
  if (typeof window === 'undefined') return DEFAULT_DECISION_CRITERIA;
  try {
    const raw = window.localStorage.getItem(CRITERIA_STORAGE_KEY);
    return raw ? sanitizeDecisionCriteria(JSON.parse(raw)) : DEFAULT_DECISION_CRITERIA;
  } catch {
    return DEFAULT_DECISION_CRITERIA;
  }
}

function fmtPct(value) {
  return value == null ? '—' : `${(value * 100).toFixed(0)}%`;
}

function fmtMultiple(value) {
  return value == null ? '—' : `${value.toFixed(1)}×`;
}

function formatCheckValue(check) {
  if (check.value == null) return '—';
  if (check.format === 'money') return fmtBRL(check.value);
  if (check.format === 'multiple') return fmtMultiple(check.value);
  if (check.format === 'pct') return fmtPct(check.value);
  return String(check.value);
}

function formatCheckThreshold(check) {
  if (check.format === 'money') return fmtBRL(check.threshold);
  if (check.format === 'multiple') return fmtMultiple(check.threshold);
  if (check.format === 'pct') return fmtPct(check.threshold);
  return String(check.threshold);
}

// ───────── Tela principal ─────────
export default function ScreenCliente({
  clientId,
  caseItem = null,
  onVoltar,
  onVerComposicao,
  onNavigate,
  onAprovar,
  onRevisaoManual,
  backLabel = 'Voltar para clientes',
}) {
  const { logout } = useAuth();
  const { data, loading, error, retry } = useClientData(clientId);
  const { data: incomeData, loading: incomeLoading, retry: retryIncome } = useIncomeComposition(clientId);
  const { data: loanData, loading: loanLoading } = useLoanInsights(clientId);
  const [exportError, setExportError] = React.useState(null);
  const [criteria, setCriteria] = React.useState(loadCriteria);
  const [metricasOpen, setMetricasOpen] = React.useState(false);

  React.useEffect(() => {
    if (data.syncPerformed) retryIncome();
  }, [data.syncPerformed, retryIncome]);

  const salvarCriteria = React.useCallback((next) => {
    const sanitized = sanitizeDecisionCriteria(next);
    setCriteria(sanitized);
    setMetricasOpen(false);
    try {
      window.localStorage.setItem(CRITERIA_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Quota excedida ou modo privado: critérios permanecem apenas em memória.
    }
  }, []);

  if (loading || incomeLoading || error) {
    return (
      <AsyncScreen
        loading={loading || incomeLoading}
        error={error}
        loadingMessage="Carregando dados..."
        loadingSub="Aguarde enquanto buscamos as informações do cliente"
        errorTitle="Erro ao carregar dados"
        onRetry={retry}
        secondaryLabel="Voltar para lista"
        onSecondary={onVoltar}
        sidebarProps={{ activeItem: 'Clientes', onNavigate, onLogout: logout }}
      />
    );
  }

  const { client, insights } = data;
  if (!client || !insights) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: TOKENS.textMuted }}>Sem dados disponíveis</div>
      </div>
    );
  }

  const summary = incomeData?.summary || {};
  const mesesIncome = (incomeData?.months || [])
    .map((mo) => mapMonth(mo))
    .sort((a, b) => a.id.localeCompare(b.id));
  const mesesAnalisados = summary.monthsAnalyzed || mesesIncome.length;

  // Renda verificada = mediana mensal de pagadores recorrentes (backend
  // IncomeCompositionService). Fonte primária: summary.validatedIncomeAvg.
  const rendaVerificada = parseFloat(summary.validatedIncomeAvg ?? 0);
  const rendaDetectada = summary.incomeDetected != null ? !!summary.incomeDetected : rendaVerificada > 0;
  const mesesRecorrentes = summary.recurringMonths != null
    ? summary.recurringMonths
    : mesesIncome.filter((m) => m.val > 0).length;

  // Renda verificada por mês (validatedIncome), base das médias e do gráfico.
  // Média 12m e volatilidade vêm de computeRendaStats (janela analisada
  // inteira, meses sem renda contam como zero), compartilhado com a fila.
  const { media12m: rendaVerificada12m, volatilidade } = computeRendaStats(incomeData);
  const tendencia = computeTendenciaRenda(incomeData);
  const perfilRenda = classifyPerfilRenda(incomeData?.detail);
  const ultimos3Val = mesesIncome.slice(-3).map((m) => m.val);
  const rendaVerificada3m = ultimos3Val.length > 0
    ? ultimos3Val.reduce((a, v) => a + v, 0) / ultimos3Val.length
    : null;

  // Entradas totais (exceto transferências entre contas) — evidência de fluxo,
  // exibida separada da renda verificada; não é renda comprovável.
  const ultimos3Entradas = mesesIncome.slice(-3).map((m) => m.receita);
  const entradas3m = ultimos3Entradas.length > 0
    ? ultimos3Entradas.reduce((a, v) => a + v, 0) / ultimos3Entradas.length
    : null;
  const entradas12m = mesesAnalisados > 0
    ? mesesIncome.reduce((a, m) => a + m.receita, 0) / mesesAnalisados
    : null;

  // Débito/Renda e capacidade de poupança vêm direto do backend (base única),
  // evitando misturar renda com entradas brutas no cálculo da tela.
  const debitoRenda = insights.debtToIncomeRatio != null ? parseFloat(insights.debtToIncomeRatio) : null;
  const capacidadePoupanca = insights.savingsCapacity3m != null ? parseFloat(insights.savingsCapacity3m) : null;

  const renda = {
    verificada: rendaVerificada,
    verificada3m: rendaVerificada3m,
    verificada12m: rendaVerificada12m,
    entradas3m,
    entradas12m,
    debito: debitoRenda,
    poupanca: capacidadePoupanca,
    volatilidade,
    tendencia,
    perfil: perfilRenda,
    mesesRecorrentes,
    mesesAnalisados,
    detectada: rendaDetectada,
  };

  const decisao = evaluateDecision(
    {
      rendaVerificada: rendaVerificada,
      debitoRenda,
      volatilidade,
      mesesRecorrentes,
    },
    criteria,
  );

  const clienteFormatado = {
    nome: client.name || '—',
    cpf: maskCpf(client.cpf) || '—',
    grupo: (caseItem?.group || caseItem?.quota)
      ? `${caseItem?.group || '—'} / ${caseItem?.quota || '—'}`
      : '—',
    produto: PRODUCT_LABELS[caseItem?.product] || caseItem?.product || '—',
    carta: caseItem?.letterValue || '—',
    status: client.active ? 'ativo' : 'inativo',
    ofConectado: !!client.akropoliLinkId,
    ofConectadoEm: insights.lastSyncAt ? fmtDate(insights.lastSyncAt) : '—',
    confianca: summary.confidence || 'Baixa',
    dataAnalise: insights.lastSyncAt ? fmtDate(insights.lastSyncAt) : '—',
    email: client.email || '—',
  };

  const mesesRenda = mesesIncome.slice(-12).map((m) => ({ m: m.label.toLowerCase(), v: m.val }));

  return (
    <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg }}>
      <Sidebar activeItem="Clientes" onNavigate={onNavigate} onLogout={logout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <PageHeader
          dataAnalise={clienteFormatado.dataAnalise}
          onVoltar={onVoltar}
          backLabel={backLabel}
          onExportExcel={async () => {
            setExportError(null);
            try {
              const [income, statement] = await Promise.all([
                clientsApi.getIncomeComposition(clientId),
                clientsApi.getStatement(clientId),
              ]);
              await exportConsolidado({
                client,
                insights,
                income,
                statement,
              });
            } catch (e) {
              console.error('Falha ao exportar dossiê', e);
              setExportError('Não foi possível exportar o dossiê agora. Tente novamente.');
            }
          }}
          onExportPdf={async () => {
            setExportError(null);
            try {
              const statement = await clientsApi.getStatement(clientId);
              exportExtratoPdf(client, statement);
            } catch (e) {
              console.error('Falha ao exportar extrato PDF', e);
              setExportError('Não foi possível exportar o extrato em PDF agora. Tente novamente.');
            }
          }}
        />
        {exportError && (
          <div role="alert" style={{
            margin: '12px 32px 0', padding: '10px 14px', borderRadius: 8,
            background: TOKENS.dangerSoft, border: `1px solid ${TOKENS.danger}33`,
            color: TOKENS.danger, fontSize: 12.5, fontWeight: 500,
          }}>
            {exportError}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 48px' }}>
          <div style={{ maxWidth: 1400, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 24 }}>
            <ContextoCliente cliente={clienteFormatado} />
            <ResumoVisual cliente={clienteFormatado} renda={renda} decisao={decisao} onDefinirMetricas={() => setMetricasOpen(true)} />
            <Evidencias cliente={clienteFormatado} renda={renda} mesesRenda={mesesRenda} onVerComposicao={onVerComposicao} />
            <DividasContratos loans={loanData} loading={loanLoading} debitoRenda={renda.debito} />
            <ExplicacaoOperador cliente={clienteFormatado} renda={renda} decisao={decisao} />
            <DecisaoSugerida
              cliente={clienteFormatado}
              renda={renda}
              decisao={decisao}
              criteria={criteria}
              onAprovar={onAprovar}
              onRevisaoManual={onRevisaoManual}
              onDetalhes={onVerComposicao}
              onDefinirMetricas={() => setMetricasOpen(true)}
            />
          </div>
        </div>
      </div>
      {metricasOpen && (
        <MetricasModal
          criteria={criteria}
          onSalvar={salvarCriteria}
          onFechar={() => setMetricasOpen(false)}
        />
      )}
    </div>
  );
}

// ───────── Header da página ─────────
function PageHeader({ dataAnalise, onVoltar, backLabel, onExportExcel, onExportPdf }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      borderBottom: `1px solid ${TOKENS.border}`,
      background: TOKENS.surface,
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onVoltar} className="lz-btn-ghost" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', fontSize: 13, fontWeight: 500, color: TOKENS.textMuted,
        }}>
          <Icon d={I.arrowLeft} size={14} stroke={TOKENS.textMuted} strokeWidth={1.8} />
          {backLabel}
        </button>
        <span style={{ color: TOKENS.borderStrong }}>·</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Análise do cliente</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onExportExcel} className="lz-btn-ghost" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', fontSize: 13, fontWeight: 500, color: TOKENS.text,
        }}>
          <Icon d={I.download} size={14} stroke={TOKENS.success} strokeWidth={1.8} />
          Exportar Excel
        </button>
        <button onClick={onExportPdf} className="lz-btn-ghost" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', fontSize: 13, fontWeight: 500, color: TOKENS.text,
        }}>
          <Icon d={I.doc} size={14} stroke={TOKENS.danger} strokeWidth={1.8} />
          Exportar PDF
        </button>
        <span style={{ fontSize: 12.5, color: TOKENS.textMuted }}>{dataAnalise}</span>
      </div>
    </div>
  );
}

// ───────── 1. Contexto do cliente ─────────
function ContextoCliente({ cliente }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={1} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Contexto do cliente</span>
      </div>
      <Card>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1.6fr',
          gap: 20,
          alignItems: 'center',
        }}>
          {/* Avatar + nome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={cliente.nome} size={44} tone="brand" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: TOKENS.text }}>{cliente.nome}</span>
                <Badge tone="neutral" size="sm">Cliente</Badge>
              </div>
              <div className="num" style={{ fontSize: 11.5, color: TOKENS.textMuted }}>
                CPF {cliente.cpf}
              </div>
            </div>
          </div>

          {/* Grupo / Cota */}
          <Field label="Grupo / Cota" value={cliente.grupo} mono />

          {/* Produto */}
          <Field label="Produto" value={cliente.produto} />

          {/* Valor da carta */}
          <Field label="Valor da carta" value={cliente.carta} mono />

          {/* Status */}
          <div>
            <div style={{ fontSize: 10.5, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
              Status
            </div>
            <Badge tone={cliente.status === 'ativo' ? 'success' : 'warning'} size="sm" dot>{cliente.status}</Badge>
          </div>

          {/* Open Finance */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            padding: '10px 14px', background: TOKENS.successSoft,
            border: `1px solid ${TOKENS.success}22`, borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: TOKENS.success,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon d={I.check} size={9} stroke="#fff" strokeWidth={3} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.success }}>Open Finance · Conectado</span>
            </div>
            <span style={{ fontSize: 11, color: TOKENS.textMuted }}>
              Conexão ativa em {cliente.ofConectadoEm}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, mono = false }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: TOKENS.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
        {label}
      </div>
      <div className={mono ? 'num' : ''} style={{ fontSize: 13, fontWeight: 500, color: TOKENS.text }}>
        {value}
      </div>
    </div>
  );
}

// ───────── 2. Resumo visual ─────────
function ResumoVisual({ cliente, renda, decisao, onDefinirMetricas }) {
  const kpis = [
    {
      label: 'Renda verificada', value: renda.verificada > 0 ? fmtBRL(renda.verificada) : '—',
      sub: 'Mediana mensal recorrente', tone: 'blue', icon: I.wallet, mono: true,
      info: 'Renda comprovável: mediana mensal dos créditos de pagadores recorrentes (presentes em ≥4 meses), excluindo transferências entre contas do titular e créditos atípicos. Calculada pelo backend (IncomeCompositionService).',
    },
    {
      label: 'Fonte de renda', value: renda.detectada ? 'Detectada' : 'Não detectada',
      sub: 'Renda recorrente', tone: renda.detectada ? 'success' : 'warning', icon: I.refresh, mono: false,
      info: 'Indica se há pagador recorrente (créditos em ≥4 meses) identificado nos lançamentos do Open Finance.',
    },
    {
      label: 'Débito/Renda', value: renda.debito != null ? `${renda.debito.toFixed(1)}×` : '—',
      sub: 'Saldo devedor ÷ renda', tone: 'warning', icon: I.alert, mono: true,
      info: 'Saldo devedor total (empréstimos e financiamentos ativos, em BRL) dividido pela mediana da renda verificada dos últimos 6 meses. Razão de estoque — não é comprometimento de parcela. Ex.: 2× = dívida equivale a 2 meses de renda.',
    },
    {
      label: 'Capacidade de poupança', value: renda.poupanca != null ? fmtBRL(renda.poupanca) : '—',
      sub: 'Renda − despesa média', tone: 'success', icon: I.chart, mono: true,
      info: 'Mediana da renda verificada dos últimos 6 meses menos a despesa média mensal dos últimos 3 meses (cálculo do backend). Valor negativo indica déficit.',
    },
  ];

  const tones = {
    blue: { bg: TOKENS.primarySoft, fg: TOKENS.primary },
    success: { bg: TOKENS.successSoft, fg: TOKENS.success },
    warning: { bg: TOKENS.warningSoft, fg: TOKENS.warning },
    danger: { bg: TOKENS.dangerSoft, fg: TOKENS.danger },
  };

  const view = DECISION_VIEW[decisao.level];
  const t = TONE[view.tone];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={2} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Resumo visual</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.4fr', gap: 12 }}>
        {kpis.map((k, i) => {
          const kt = tones[k.tone] ?? tones.blue;
          return (
            <div key={i} className="lz-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, background: kt.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon d={k.icon} size={13} stroke={kt.fg} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 500, lineHeight: 1.25 }}>
                  {k.label}
                </div>
                <InfoTip text={k.info} />
              </div>
              <div className={k.mono ? 'num' : ''} style={{ fontSize: 18, fontWeight: 700, color: TOKENS.text, letterSpacing: -0.4 }}>
                {k.value}
              </div>
              <div style={{ fontSize: 10.5, color: TOKENS.textSubtle, marginTop: 4 }}>{k.sub}</div>
            </div>
          );
        })}

        {/* Recomendação card */}
        <div className="lz-card" style={{
          padding: '14px 16px',
          background: `linear-gradient(135deg, ${t.soft} 0%, #fff 100%)`,
          border: `1px solid ${t.fg}33`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, background: t.fg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon d={view.icon} size={13} stroke="#fff" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 500 }}>Recomendação</span>
            <InfoTip text="Sugestão automática a partir da renda verificada e dos critérios de aceite da empresa (Débito/Renda, volatilidade, meses recorrentes). Não substitui a análise do operador." />
            <button
              onClick={onDefinirMetricas}
              className="lz-btn-ghost"
              title="Definir métricas de aceite"
              style={{
                marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, padding: 0, borderRadius: 6,
              }}
            >
              <Icon d={I.settings} size={13} stroke={TOKENS.textMuted} strokeWidth={1.8} />
            </button>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.fg, lineHeight: 1.3 }}>
            {view.label}
          </div>
          <div style={{ fontSize: 10.5, color: TOKENS.textMuted, marginTop: 5 }}>
            {view.tagline}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── 3. Evidências ─────────
function Evidencias({ cliente, renda, mesesRenda, onVerComposicao }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <StepNumber n={3} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Evidências</span>
        <Badge tone="blue" size="sm" dot>agregado · Open Finance</Badge>
      </div>
      <p style={{ margin: '0 0 12px 32px', fontSize: 12.5, color: TOKENS.textMuted }}>
        Renda verificada (pagadores recorrentes) separada das entradas totais, nos últimos 12 meses, exceto transferências entre contas do titular.
      </p>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          <EvidKpi label="Perfil de renda" value={renda.perfil.label} sub={renda.detectada ? 'Pagador em ≥4 meses' : 'Não detectado'}
            tone={renda.perfil.perfil === 'folha' ? 'success' : renda.perfil.perfil === 'indeterminado' ? 'warning' : undefined}
            info={`${renda.perfil.descricao} Classificação heurística a partir dos créditos recorrentes do Open Finance — não substitui verificação documental de vínculo.`} />
          <EvidKpi label="Renda verificada (12m)" value={renda.verificada12m != null ? fmtBRL(renda.verificada12m) : '—'} sub="Média mensal recorrente" tone="blue" mono
            info="Média mensal da renda verificada (créditos de pagadores recorrentes) no período analisado (até 12 meses)." />
          <EvidKpi label="Entradas totais (12m)" value={renda.entradas12m != null ? fmtBRL(renda.entradas12m) : '—'} sub="Média mensal · não é renda" mono
            info="Média mensal de todas as entradas exceto transferências entre contas do titular. Inclui créditos não recorrentes e atípicos — referência de fluxo, não renda comprovável." />
          <EvidKpi label="Volatilidade"
            value={renda.volatilidade != null ? `${(renda.volatilidade * 100).toFixed(0)}%` : '—'}
            sub={renda.volatilidade == null ? 'Sem dado no período'
              : renda.volatilidade <= 0.25 ? 'Oscilação baixa'
              : renda.volatilidade <= 0.5 ? 'Oscilação moderada'
              : 'Oscilação alta'}
            mono
            info="Quanto a renda verificada mensal oscilou na janela analisada (meses sem renda recorrente contam como zero): desvio padrão dividido pela média (coeficiente de variação). Quanto maior o percentual, mais instável a renda." />
          <EvidKpi label="Tendência"
            value={renda.tendencia.tendencia === 'crescente' ? 'Crescente'
              : renda.tendencia.tendencia === 'decrescente' ? 'Decrescente'
              : renda.tendencia.tendencia === 'estavel' ? 'Estável' : '—'}
            sub={renda.tendencia.variacao != null
              ? `${renda.tendencia.variacao > 0 ? '+' : ''}${(renda.tendencia.variacao * 100).toFixed(0)}% vs 3m anteriores`
              : renda.tendencia.tendencia === 'crescente' ? 'Sem base de comparação' : 'Janela insuficiente'}
            tone={renda.tendencia.tendencia === 'crescente' ? 'success'
              : renda.tendencia.tendencia === 'decrescente' ? 'danger' : undefined}
            info="Direção recente da renda verificada: média dos 3 últimos meses comparada à média dos 3 meses anteriores (meses sem renda contam como zero). Acima de +10% crescente, abaixo de −10% decrescente. Indicador retrospectivo — não é projeção." />
        </div>

        {/* Chart */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>
                Evolução da renda verificada
              </div>
              <div style={{ fontSize: 11.5, color: TOKENS.textMuted }}>
                Renda verificada por mês (pagadores recorrentes) · últimos 12 meses
              </div>
            </div>
            {onVerComposicao && (
              <button onClick={onVerComposicao} className="lz-btn-primary" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', fontSize: 12, fontWeight: 500,
              }}>
                <Icon d={I.link} size={13} stroke="#FFFFFF" strokeWidth={1.8} />
                Ver composição detalhada
              </button>
            )}
          </div>
          <IncomeChart data={mesesRenda.length > 0 ? mesesRenda : [{ m: 'Sem dados', v: 0 }]} />
        </div>
      </Card>
    </div>
  );
}

function IncomeChart({ data }) {
  const fmtChartValue = (v) => (
    v >= 1000
      ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
      : fmtBRL(v)
  );
  const W = 780, H = 180;
  const pad = { top: 24, right: 16, bottom: 34, left: 52 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const rawMax = Math.max(...data.map((d) => d.v), 0);
  const niceCeil = (x) => {
    if (x <= 0) return 3000;
    const pow = Math.pow(10, Math.floor(Math.log10(x)));
    const n = x / pow;
    const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return mult * pow;
  };
  const maxV = niceCeil(rawMax);
  const barW = (cW / data.length) * 0.5;
  const yLines = [0, maxV / 4, maxV / 2, (3 * maxV) / 4, maxV];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Y grid lines + labels */}
      {yLines.map((v) => {
        const y = pad.top + cH - (v / maxV) * cH;
        return (
          <g key={v}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y}
              stroke={TOKENS.border} strokeWidth={1} strokeDasharray={v === 0 ? 'none' : '3 3'} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={9.5} fill={TOKENS.textMuted}>
              {v === 0 ? 'R$ 0' : fmtChartValue(v)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.v / maxV) * cH;
        const slotW = cW / data.length;
        const x = pad.left + slotW * i + (slotW - barW) / 2;
        const y = pad.top + cH - barH;
        const label = d.v > 0 ? fmtChartValue(d.v) : '';
        return (
          <g key={`${d.m}-${i}`}>
            <rect x={x} y={y} width={barW} height={barH} rx={3}
              fill={TOKENS.brandLight} />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={8} fill={TOKENS.textMuted}>
              {label}
            </text>
            <text x={x + barW / 2} y={H - pad.bottom + 13} textAnchor="middle" fontSize={8.5} fill={TOKENS.textMuted}>
              {d.m}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ───────── 4. Dívidas e contratos ─────────
const PRODUCT_TYPE_LABELS = {
  EMPRESTIMO_PESSOAL: 'Empréstimo pessoal',
  EMPRESTIMO_CONSIGNADO: 'Empréstimo consignado',
  FINANCIAMENTO: 'Financiamento',
  FINANCIAMENTO_IMOBILIARIO: 'Financiamento imobiliário',
  FINANCIAMENTO_VEICULO: 'Financiamento de veículo',
  CREDITO_PESSOAL_COM_CONSIGNACAO: 'Crédito pessoal consignado',
  CREDITO_PESSOAL_SEM_CONSIGNACAO: 'Crédito pessoal',
  CARTAO_CREDITO: 'Cartão de crédito',
  CHEQUE_ESPECIAL: 'Cheque especial',
};

function productTypeLabel(type) {
  if (!type) return '—';
  return PRODUCT_TYPE_LABELS[type]
    || String(type).replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

// Datas do Open Finance chegam como 'YYYY-MM-DD'; formatação direta evita que o
// fuso horário desloque o dia.
function fmtLocalDate(value) {
  const [y, m, d] = String(value || '').slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${String(y).slice(-2)}`;
}

function DividasContratos({ loans, loading, debitoRenda }) {
  const dados = loans?.data ?? loans ?? null;
  const contratos = dados?.activeContractsCount ?? 0;
  const porProduto = Array.isArray(dados?.byProductType) ? dados.byProductType : [];
  const saldoTotalBrl = (Array.isArray(dados?.byCurrency) ? dados.byCurrency : [])
    .filter((c) => String(c.currency || '').toUpperCase() === 'BRL')
    .reduce((a, c) => a + (parseFloat(c.totalOutstandingBalance) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={4} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Dívidas e contratos</span>
        <Badge tone="blue" size="sm" dot>agregado · Open Finance</Badge>
        <InfoTip text="Contratos ativos de empréstimo e financiamento identificados via Open Finance, agregados por tipo de produto. Base do numerador do Débito/Renda." />
      </div>
      <Card>
        {loading ? (
          <div style={{ fontSize: 12.5, color: TOKENS.textMuted }}>Carregando contratos…</div>
        ) : contratos === 0 ? (
          <div style={{ fontSize: 12.5, color: TOKENS.textMuted }}>
            Nenhum contrato ativo de empréstimo ou financiamento identificado via Open Finance.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
              <EvidKpi label="Contratos ativos" value={String(contratos)} sub="Empréstimos e financiamentos" mono
                info="Quantidade de contratos ativos (sem data de liquidação) identificados via Open Finance." />
              <EvidKpi label="Saldo devedor" value={saldoTotalBrl > 0 ? fmtBRL(saldoTotalBrl) : '—'} sub="Total em BRL" tone="warning" mono
                info="Soma do saldo devedor dos contratos ativos em BRL. É o numerador do Débito/Renda." />
              <EvidKpi label="Próximo vencimento" value={fmtLocalDate(dados?.nextDueDate)} sub="Entre os contratos ativos" mono
                info="Próxima parcela com vencimento futuro entre os contratos ativos." />
              <EvidKpi label="Débito/Renda" value={debitoRenda != null ? `${debitoRenda.toFixed(1)}×` : '—'} sub="Saldo devedor ÷ renda verificada" mono
                info="Saldo devedor total dividido pela mediana da renda verificada dos últimos 6 meses (cálculo do backend)." />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                  {['Produto', 'Contratos', 'Saldo devedor'].map((h, i) => (
                    <th key={h} style={{
                      padding: '8px 10px', textAlign: i === 0 ? 'left' : 'right',
                      fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4,
                      color: TOKENS.textMuted, fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porProduto.map((p) => (
                  <tr key={p.productType} style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                    <td style={{ padding: '9px 10px', color: TOKENS.text, fontWeight: 500 }}>{productTypeLabel(p.productType)}</td>
                    <td className="num" style={{ padding: '9px 10px', textAlign: 'right', color: TOKENS.textMuted }}>{p.count}</td>
                    <td className="num" style={{ padding: '9px 10px', textAlign: 'right', color: TOKENS.text, fontWeight: 600 }}>
                      {p.totalOutstandingBalance != null ? fmtBRL(parseFloat(p.totalOutstandingBalance)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}

// ───────── 5. Explicação para o operador ─────────
function ExplicacaoOperador({ cliente, renda, decisao }) {
  const rows = [
    { l: 'Renda verificada (mediana)', v: renda.verificada > 0 ? fmtBRL(renda.verificada) : '—', mono: true, color: TOKENS.primary },
    { l: 'Renda verificada (12m · média)', v: renda.verificada12m != null ? fmtBRL(renda.verificada12m) : '—', mono: true, color: TOKENS.text },
    { l: 'Entradas totais (12m · média)', v: renda.entradas12m != null ? fmtBRL(renda.entradas12m) : '—', mono: true, color: TOKENS.textMuted },
    { l: 'Débito/Renda', v: renda.debito != null ? `${renda.debito.toFixed(1)}×` : '—', mono: true, color: TOKENS.warning },
    { l: 'Capacidade de poupança', v: renda.poupanca != null ? fmtBRL(renda.poupanca) : '—', mono: true, color: TOKENS.success },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={5} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Explicação para o operador</span>
      </div>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 24 }}>
          {/* Tabela de comparação */}
          <div style={{
            background: TOKENS.panel, border: `1px solid ${TOKENS.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            {rows.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: i < rows.length - 1 ? `1px solid ${TOKENS.border}` : 'none',
              }}>
                <span style={{ fontSize: 12.5, color: TOKENS.textMuted }}>{r.l}</span>
                <span className={r.mono ? 'num' : ''} style={{ fontSize: 13, fontWeight: 700, color: r.color }}>
                  {r.v}
                </span>
              </div>
            ))}
          </div>

          {/* Narrativa */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: TOKENS.primarySoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon d={I.info} size={16} stroke={TOKENS.primary} strokeWidth={1.8} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: TOKENS.text, lineHeight: 1.7, textWrap: 'pretty' }}>
              {renda.detectada
                ? <>Identificamos <strong>renda recorrente</strong> via Open Finance em <strong>{renda.mesesRecorrentes}</strong> mês(es). A renda verificada (mediana mensal) é de <strong>{renda.verificada > 0 ? fmtBRL(renda.verificada) : '—'}</strong>/mês, com média anual de <strong>{renda.verificada12m != null ? fmtBRL(renda.verificada12m) : '—'}</strong>/mês. As entradas totais (<strong>{renda.entradas12m != null ? fmtBRL(renda.entradas12m) : '—'}</strong>/mês) incluem créditos não recorrentes e não comprovam renda.</>
                : <>Não identificamos <strong>renda recorrente</strong> que comprove renda nos créditos do Open Finance (nenhum pagador com repetição mensal estável no período). A composição detalhada lista os créditos classificados.</>}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ───────── 6. Decisão sugerida ─────────
function DecisaoSugerida({ cliente, renda, decisao, criteria, onAprovar, onRevisaoManual, onDetalhes, onDefinirMetricas }) {
  const view = DECISION_VIEW[decisao.level];
  const t = TONE[view.tone];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={6} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Decisão sugerida</span>
        <button
          onClick={onDefinirMetricas}
          className="lz-btn-ghost"
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', fontSize: 12.5, fontWeight: 500, color: TOKENS.text,
          }}
        >
          <Icon d={I.settings} size={14} stroke={TOKENS.primary} strokeWidth={1.8} />
          Definir métricas
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Recomendação */}
          <div className="lz-card" style={{
            padding: '16px 20px',
            background: `linear-gradient(180deg, ${t.soft} 0%, #fff 80%)`,
            border: `1px solid ${t.fg}33`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, background: t.fg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon d={view.icon} size={17} stroke="#fff" strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.fg, marginBottom: 4 }}>
                  {view.label}
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 12.5, color: TOKENS.text, lineHeight: 1.55 }}>
                  {decisao.incomeProven
                    ? <>Renda verificada de <strong>{renda.verificada > 0 ? fmtBRL(renda.verificada) : '—'}</strong>/mês em <strong>{renda.mesesRecorrentes}</strong> mês(es) recorrentes. {view.tagline}</>
                    : <>Sem renda recorrente comprovável no período. Recomenda-se solicitar complemento ou revisar a composição detalhada.</>}
                </p>
                <CriteriosChecklist decisao={decisao} />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onAprovar}
              disabled={!onAprovar}
              title={!onAprovar ? 'Ação indisponível nesta POC' : undefined}
              className="lz-btn-primary"
              style={{
                padding: '11px 20px', fontSize: 13.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: onAprovar ? 1 : 0.5, cursor: onAprovar ? 'pointer' : 'not-allowed',
              }}
            >
              <Icon d={I.check} size={15} stroke="#fff" strokeWidth={2.5} />
              {view.label}
            </button>
            <button
              onClick={onRevisaoManual}
              disabled={!onRevisaoManual}
              title={!onRevisaoManual ? 'Ação indisponível nesta POC' : undefined}
              className="lz-btn-ghost"
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 500, color: TOKENS.text,
                opacity: onRevisaoManual ? 1 : 0.5, cursor: onRevisaoManual ? 'pointer' : 'not-allowed',
              }}
            >
              Enviar para revisão manual
            </button>
            <button
              onClick={onDetalhes}
              disabled={!onDetalhes}
              className="lz-btn-ghost"
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 500, color: TOKENS.text,
                opacity: onDetalhes ? 1 : 0.5, cursor: onDetalhes ? 'pointer' : 'not-allowed',
              }}
            >
              Ver mais detalhes
            </button>
          </div>
        </div>

        {/* Informações do cliente */}
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
            Informações do cliente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { l: 'Email', v: cliente.email },
              { l: 'CPF', v: cliente.cpf, mono: true },
              { l: 'Status', v: cliente.status },
              { l: 'Grupo / Cota', v: cliente.grupo, mono: true },
              { l: 'Valor da carta', v: cliente.carta, mono: true },
              { l: 'Renda verificada', v: renda.verificada > 0 ? fmtBRL(renda.verificada) : '—', mono: true },
              { l: 'Débito/Renda', v: renda.debito != null ? `${renda.debito.toFixed(1)}×` : '—', mono: true },
            ].map((f, i, arr) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: 12, paddingBottom: 10,
                borderBottom: i < arr.length - 1 ? `1px solid ${TOKENS.border}` : 'none',
              }}>
                <span style={{ fontSize: 12, color: TOKENS.textMuted, flexShrink: 0 }}>{f.l}</span>
                <span className={f.mono ? 'num' : ''} style={{ fontSize: 12.5, fontWeight: 500, color: TOKENS.text, textAlign: 'right' }}>
                  {f.v}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Checklist dos critérios de aceite avaliados na recomendação.
function CriteriosChecklist({ decisao }) {
  const comparador = { gte: '≥', lte: '≤' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {decisao.checks.map((c) => {
        const cor = c.ok ? TOKENS.success : TOKENS.danger;
        return (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <div style={{
              width: 15, height: 15, borderRadius: '50%', background: c.ok ? TOKENS.successSoft : TOKENS.dangerSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon d={c.ok ? I.check : I.x} size={9} stroke={cor} strokeWidth={2.5} />
            </div>
            <span style={{ color: TOKENS.textMuted }}>{c.label}</span>
            <span className="num" style={{ marginLeft: 'auto', fontWeight: 600, color: TOKENS.text }}>
              {formatCheckValue(c)}
            </span>
            <span className="num" style={{ color: TOKENS.textSubtle, minWidth: 64, textAlign: 'right' }}>
              {comparador[c.comparator]} {formatCheckThreshold(c)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ───────── Pop-up: definir métricas de aceite ─────────
function MetricasModal({ criteria, onSalvar, onFechar }) {
  const [form, setForm] = React.useState({
    rendaMinima: String(criteria.rendaMinima),
    debitoRendaMax: String(criteria.debitoRendaMax),
    volatilidadeMax: String(Math.round(criteria.volatilidadeMax * 100)),
    mesesRecorrentesMin: String(criteria.mesesRecorrentesMin),
  });

  const setField = (key) => (event) => setForm((cur) => ({ ...cur, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    onSalvar({
      rendaMinima: parseFloat(form.rendaMinima),
      debitoRendaMax: parseFloat(form.debitoRendaMax),
      volatilidadeMax: parseFloat(form.volatilidadeMax) / 100,
      mesesRecorrentesMin: parseInt(form.mesesRecorrentesMin, 10),
    });
  };

  const restaurar = () => setForm({
    rendaMinima: String(DEFAULT_DECISION_CRITERIA.rendaMinima),
    debitoRendaMax: String(DEFAULT_DECISION_CRITERIA.debitoRendaMax),
    volatilidadeMax: String(Math.round(DEFAULT_DECISION_CRITERIA.volatilidadeMax * 100)),
    mesesRecorrentesMin: String(DEFAULT_DECISION_CRITERIA.mesesRecorrentesMin),
  });

  const campos = [
    { key: 'rendaMinima', label: 'Renda verificada mínima', suffix: 'R$/mês', step: '100', min: '0', hint: 'Abaixo deste valor a recomendação passa a "revisar".' },
    { key: 'debitoRendaMax', label: 'Débito/Renda máximo', suffix: '×', step: '0.1', min: '0', hint: 'Teto da razão Débito/Renda aceitável.' },
    { key: 'volatilidadeMax', label: 'Volatilidade máxima', suffix: '%', step: '5', min: '0', hint: 'Teto da oscilação (coeficiente de variação) da renda.' },
    { key: 'mesesRecorrentesMin', label: 'Meses recorrentes mínimos', suffix: 'meses', step: '1', min: '0', hint: 'Mínimo de meses com renda recorrente para comprovar renda.' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Definir métricas de aceite"
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(16,26,51,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: '100%', maxWidth: 460, background: TOKENS.surface,
          borderRadius: RADII.modal, boxShadow: SHADOWS.modal, overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${TOKENS.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: TOKENS.primarySoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon d={I.settings} size={16} stroke={TOKENS.primary} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Definir métricas de aceite</div>
              <div style={{ fontSize: 11.5, color: TOKENS.textMuted }}>Critérios usados na recomendação automática</div>
            </div>
          </div>
          <button type="button" onClick={onFechar} className="lz-btn-ghost" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, padding: 0, borderRadius: 8,
          }}>
            <Icon d={I.x} size={15} stroke={TOKENS.textMuted} strokeWidth={2} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {campos.map((c) => (
            <label key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text }}>{c.label}</span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                border: `1px solid ${TOKENS.border}`, borderRadius: RADII.control,
                padding: '0 12px', background: TOKENS.panel,
              }}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={c.min}
                  step={c.step}
                  value={form[c.key]}
                  onChange={setField(c.key)}
                  required
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    padding: '10px 0', fontSize: 13.5, fontWeight: 600, color: TOKENS.text,
                  }}
                />
                <span style={{ fontSize: 12, color: TOKENS.textMuted, fontWeight: 500 }}>{c.suffix}</span>
              </div>
              <span style={{ fontSize: 11, color: TOKENS.textSubtle }}>{c.hint}</span>
            </label>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '14px 20px', borderTop: `1px solid ${TOKENS.border}`, background: TOKENS.panel,
        }}>
          <button type="button" onClick={restaurar} className="lz-btn-ghost" style={{
            padding: '9px 14px', fontSize: 12.5, fontWeight: 500, color: TOKENS.textMuted,
          }}>
            Restaurar padrão
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onFechar} className="lz-btn-ghost" style={{
              padding: '9px 16px', fontSize: 13, fontWeight: 500, color: TOKENS.text,
            }}>
              Cancelar
            </button>
            <button type="submit" className="lz-btn-primary" style={{
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
            }}>
              Salvar critérios
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
