// Tela de análise do cliente: contexto, resumo visual de KPIs, evidências de receita
// (entradas totais via Open Finance), gráfico de evolução da receita, explicação ao
// operador e decisão sugerida, a partir dos hooks useClientData e useIncomeComposition.

import React from 'react';
import { TOKENS, I } from './tokens.js';
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
import { useAuth } from './hooks/useAuth';
import { mapMonth } from './services/domain';
import { clientsApi } from './services/api';
import { exportConsolidado } from './services/exportExcel.js';
import { exportExtratoPdf } from './services/exportPdf.js';
import { fmtBRL, fmtDate } from './lib/format';

// ───────── Tela principal ─────────
export default function ScreenCliente({
  clientId,
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
  const [exportError, setExportError] = React.useState(null);

  React.useEffect(() => {
    if (data.syncPerformed) retryIncome();
  }, [data.syncPerformed, retryIncome]);

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

  const mesesIncome = (incomeData?.months || [])
    .map((mo) => mapMonth(mo))
    .sort((a, b) => a.id.localeCompare(b.id));
  const mesesAnalisados = incomeData?.summary?.monthsAnalyzed || mesesIncome.length;
  const somaReceita = mesesIncome.reduce((a, m) => a + m.receita, 0);
  const receita12m = mesesAnalisados > 0 ? somaReceita / mesesAnalisados : null;
  const ultimos3 = mesesIncome.slice(-3);
  const receita3m = ultimos3.length > 0
    ? ultimos3.reduce((a, m) => a + m.receita, 0) / ultimos3.length
    : null;

  const rendaBase3m = parseFloat(insights.avgMonthlyIncome3m ?? 0);
  const dividaTotal = insights.debtToIncomeRatio != null
    ? parseFloat(insights.debtToIncomeRatio) * rendaBase3m
    : null;
  const debitoReceita = dividaTotal != null && receita3m > 0 ? dividaTotal / receita3m : null;
  const despesa3m = insights.savingsCapacity3m != null
    ? rendaBase3m - parseFloat(insights.savingsCapacity3m)
    : null;
  const poupancaReceita = despesa3m != null && receita3m != null ? receita3m - despesa3m : null;

  const totaisMensais = mesesIncome.map((m) => m.receita);
  const volatilidade = (() => {
    if (totaisMensais.length < 2) return null;
    const media = totaisMensais.reduce((a, v) => a + v, 0) / totaisMensais.length;
    if (media <= 0) return null;
    const variancia = totaisMensais.reduce((a, v) => a + (v - media) ** 2, 0) / totaisMensais.length;
    return Math.sqrt(variancia) / media;
  })();

  const receita = {
    media3m: receita3m,
    media12m: receita12m,
    debito: debitoReceita,
    poupanca: poupancaReceita,
    volatilidade,
  };

  const clienteFormatado = {
    nome: client.name || '—',
    cpf: client.cpf ? client.cpf.slice(-5).padStart(11, '●') : '—',
    grupo: '—',
    produto: '—',
    status: client.active ? 'ativo' : 'inativo',
    ofConectado: !!client.akropoliLinkId,
    ofConectadoEm: insights.lastSyncAt ? fmtDate(insights.lastSyncAt) : '—',
    rendaDeclarada: parseFloat(insights.avgMonthlyIncome12m ?? 0),
    rendaVerificada: parseFloat(insights.avgMonthlyIncome3m ?? 0),
    diferenca: (parseFloat(insights.avgMonthlyIncome12m ?? 0) - parseFloat(insights.avgMonthlyIncome3m ?? 0)),
    divergencia: 0,
    variacao: null,
    fontes: insights.incomeDetected ? 1 : 0,
    atipicos: 0,
    confianca: incomeData?.summary?.confidence || 'Baixa',
    dataAnalise: insights.lastSyncAt ? fmtDate(insights.lastSyncAt) : '—',
    contemplacao: '—',
    prioridade: 'Média',
    consultor: '—',
    telefone: '—',
    email: client.email || '—',
  };

  const mesesReceita = mesesIncome.slice(-12).map((m) => ({ m: m.label.toLowerCase(), v: m.receita }));

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
            <ResumoVisual cliente={clienteFormatado} receita={receita} />
            <Evidencias cliente={clienteFormatado} receita={receita} mesesReceita={mesesReceita} onVerComposicao={onVerComposicao} />
            <ExplicacaoOperador cliente={clienteFormatado} receita={receita} />
            <DecisaoSugerida
              cliente={clienteFormatado}
              receita={receita}
              onAprovar={onAprovar}
              onRevisaoManual={onRevisaoManual}
              onDetalhes={onVerComposicao}
            />
          </div>
        </div>
      </div>
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
          gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.6fr',
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
function ResumoVisual({ cliente, receita }) {
  const kpis = [
    {
      label: 'Receita', value: receita.media3m != null ? fmtBRL(receita.media3m) : '—',
      sub: 'Média mensal (3m)', tone: 'blue', icon: I.wallet, mono: true,
      info: 'Média mensal da receita (créditos identificados via Open Finance, exceto transferências entre contas do titular) nos últimos 3 meses.',
    },
    {
      label: 'Fonte de renda', value: cliente.fontes > 0 ? 'Detectada' : 'Não detectada',
      sub: 'Renda recorrente', tone: cliente.fontes > 0 ? 'success' : 'warning', icon: I.refresh, mono: false,
      info: 'Indica se há pagador recorrente (créditos em ≥4 meses) identificado nos lançamentos do Open Finance.',
    },
    {
      label: 'Débito/Receita', value: receita.debito != null ? `${receita.debito.toFixed(1)}×` : '—',
      sub: 'Saldo devedor ÷ receita', tone: 'warning', icon: I.alert, mono: true,
      info: 'Saldo devedor total dos empréstimos (Open Finance) dividido pela receita mensal (exceto transferências entre contas). Ex.: 2× = dívida equivale a 2 meses de receita.',
    },
    {
      label: 'Capacidade de poupança', value: receita.poupanca != null ? fmtBRL(receita.poupanca) : '—',
      sub: 'Receita − despesa (3m)', tone: 'success', icon: I.chart, mono: true,
      info: 'Receita (exceto transferências entre contas) menos a despesa média mensal dos últimos 3 meses. Valor negativo indica déficit (gasta mais do que recebe).',
    },
  ];

  const tones = {
    blue:    { bg: TOKENS.primarySoft,  fg: TOKENS.primary },
    success: { bg: TOKENS.successSoft,  fg: TOKENS.success },
    warning: { bg: TOKENS.warningSoft,  fg: TOKENS.warning },
    danger:  { bg: TOKENS.dangerSoft,   fg: TOKENS.danger },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={2} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Resumo visual</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.4fr', gap: 12 }}>
        {kpis.map((k, i) => {
          const t = tones[k.tone] ?? tones.blue;
          return (
            <div key={i} className="lz-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, background: t.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon d={k.icon} size={13} stroke={t.fg} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 500, lineHeight: 1.25 }}>
                  {k.label}
                </div>
                <InfoTip text={k.info} />
              </div>
              {k.isBadge ? (
                <Badge tone={k.badgeTone} size="md" dot>{k.value}</Badge>
              ) : (
                <div className={k.mono ? 'num' : ''} style={{ fontSize: 18, fontWeight: 700, color: TOKENS.text, letterSpacing: -0.4 }}>
                  {k.value}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: TOKENS.textSubtle, marginTop: 4 }}>{k.sub}</div>
            </div>
          );
        })}

        {/* Recomendação card */}
        <div className="lz-card" style={{
          padding: '14px 16px',
          background: `linear-gradient(135deg, ${cliente.fontes > 0 ? TOKENS.successSoft : TOKENS.warningSoft} 0%, #fff 100%)`,
          border: `1px solid ${cliente.fontes > 0 ? TOKENS.success : TOKENS.warning}33`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, background: cliente.fontes > 0 ? TOKENS.success : TOKENS.warning,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon d={cliente.fontes > 0 ? I.shieldCheck : I.alert} size={13} stroke="#fff" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 500 }}>Recomendação</span>
            <InfoTip text="Sugestão automática com base na detecção de renda recorrente comprovável no Open Finance. Não substitui a análise do operador." />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: cliente.fontes > 0 ? TOKENS.success : TOKENS.warning, lineHeight: 1.3 }}>
            {cliente.fontes > 0 ? 'Aprovar comprovação de renda' : 'Solicitar complemento de renda'}
          </div>
          <div style={{ fontSize: 10.5, color: TOKENS.textMuted, marginTop: 5 }}>
            {cliente.fontes > 0 ? 'Renda recorrente comprovada' : 'Sem renda recorrente no período'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── 3. Evidências ─────────
function Evidencias({ cliente, receita, mesesReceita, onVerComposicao }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <StepNumber n={3} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Evidências</span>
        <Badge tone="blue" size="sm" dot>agregado · Open Finance</Badge>
      </div>
      <p style={{ margin: '0 0 12px 32px', fontSize: 12.5, color: TOKENS.textMuted }}>
        Créditos identificados via Open Finance nos últimos 12 meses, exceto transferências entre contas do titular.
      </p>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <EvidKpi label="Salário recorrente" value={cliente.fontes > 0 ? 'Sim' : 'Não'} sub={cliente.fontes > 0 ? 'Depósitos em dia útil' : 'Não detectado'} tone={cliente.fontes > 0 ? 'success' : 'warning'}
            info="Há crédito de pagador recorrente (presente em ≥4 meses) identificado nos lançamentos do Open Finance." />
          <EvidKpi label="Receita trimestral" value={receita.media3m != null ? fmtBRL(receita.media3m) : '—'} sub="Média mensal (3m)" mono
            info="Média mensal da receita (exceto transferências entre contas) nos últimos 3 meses." />
          <EvidKpi label="Receita anual" value={receita.media12m != null ? fmtBRL(receita.media12m) : '—'} sub="Média mensal (12m)" tone="blue" mono
            info="Média mensal da receita (exceto transferências entre contas) no período analisado (até 12 meses)." />
          <EvidKpi label="Volatilidade"
            value={receita.volatilidade != null ? `${(receita.volatilidade * 100).toFixed(0)}%` : '—'}
            sub={receita.volatilidade == null ? 'Sem dado no período'
              : receita.volatilidade <= 0.25 ? 'Oscilação baixa'
              : receita.volatilidade <= 0.5 ? 'Oscilação moderada'
              : 'Oscilação alta'}
            mono
            info="Quanto a receita mensal (exceto transferências entre contas) oscilou no período analisado: desvio padrão dividido pela média (coeficiente de variação). Quanto maior o percentual, mais instável a receita." />
        </div>

        {/* Chart */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>
                Evolução da receita
              </div>
              <div style={{ fontSize: 11.5, color: TOKENS.textMuted }}>
                Receita por mês (exceto transferências entre contas) · últimos 12 meses
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
          <IncomeChart data={mesesReceita.length > 0 ? mesesReceita : [{ m: 'Sem dados', v: 0 }]} />
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

// ───────── 4. Explicação para o operador ─────────
function ExplicacaoOperador({ cliente, receita }) {
  const rows = [
    { l: 'Receita (3m · média)',  v: receita.media3m != null ? fmtBRL(receita.media3m) : '—', mono: true, color: TOKENS.primary },
    { l: 'Receita (12m · média)', v: receita.media12m != null ? fmtBRL(receita.media12m) : '—', mono: true, color: TOKENS.text },
    { l: 'Débito/Receita',        v: receita.debito != null ? `${receita.debito.toFixed(1)}×` : '—', mono: true, color: TOKENS.warning },
    { l: 'Capacidade de poupança', v: receita.poupanca != null ? fmtBRL(receita.poupanca) : '—', mono: true, color: TOKENS.success },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={4} />
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
              {cliente.fontes > 0
                ? <>Identificamos <strong>renda recorrente</strong> via Open Finance. A receita é de <strong>{receita.media3m != null ? fmtBRL(receita.media3m) : '—'}</strong>/mês (média da receita dos últimos 3 meses, exceto transferências entre contas), com média anual de <strong>{receita.media12m != null ? fmtBRL(receita.media12m) : '—'}</strong>/mês.</>
                : <>Não identificamos <strong>renda recorrente</strong> que comprove renda nos créditos do Open Finance (nenhum pagador com repetição mensal estável no período). A composição detalhada lista os créditos classificados.</>}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ───────── 5. Decisão sugerida ─────────
function DecisaoSugerida({ cliente, receita, onAprovar, onRevisaoManual, onDetalhes }) {
  const aprovado = cliente.fontes > 0;
  const recomendacao = aprovado ? 'Aprovar comprovação' : 'Solicitar complemento';
  const tone = aprovado ? 'success' : 'warning';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={5} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Decisão sugerida</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Recomendação */}
          <div className="lz-card" style={{
            padding: '16px 20px',
            background: tone === 'success' ? `linear-gradient(180deg, ${TOKENS.successSoft} 0%, #fff 80%)` : `linear-gradient(180deg, ${TOKENS.warningSoft} 0%, #fff 80%)`,
            border: `1px solid ${tone === 'success' ? TOKENS.success : TOKENS.warning}33`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, background: tone === 'success' ? TOKENS.success : TOKENS.warning,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon d={tone === 'success' ? I.shieldCheck : I.alert} size={17} stroke="#fff" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: tone === 'success' ? TOKENS.success : TOKENS.warning, marginBottom: 4 }}>
                  {recomendacao}
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: TOKENS.text, lineHeight: 1.55 }}>
                  {aprovado
                    ? <>Renda recorrente comprovada, com receita média de <strong>{receita.media3m != null ? fmtBRL(receita.media3m) : '—'}</strong>/mês. As evidências do Open Finance sustentam a comprovação automatizada.</>
                    : <>Sem renda recorrente comprovável no período. Recomenda-se solicitar complemento ou revisar a composição detalhada.</>}
                </p>
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
              {recomendacao}
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

          {!aprovado && (
            <div style={{ textAlign: 'center' }}>
              <a href="#" className="lz-link" style={{
                fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5,
                color: TOKENS.warning,
              }}>
                <Icon d={I.alert} size={13} stroke={TOKENS.warning} strokeWidth={1.8} />
                Renda não comprovada - revisar
              </a>
            </div>
          )}
        </div>

        {/* Informações do cliente */}
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
            Informações do cliente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { l: 'Email',             v: cliente.email },
              { l: 'CPF',               v: cliente.cpf, mono: true },
              { l: 'Status',            v: cliente.status },
              { l: 'Receita',        v: receita.media3m != null ? fmtBRL(receita.media3m) : '—', mono: true },
              { l: 'Débito/Receita', v: receita.debito != null ? `${receita.debito.toFixed(1)}×` : '—', mono: true },
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
