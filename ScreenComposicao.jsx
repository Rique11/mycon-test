// Tela de composição da renda verificada: resumo, tabela mensal, detalhamento de
// créditos por mês (incluindo o grupo "C. Renda Recorrente", com o status de
// cada lançamento recorrente: há quantos meses se repete ou período em que
// esteve ativo antes de encerrar), critérios e leitura operacional. Consome o
// endpoint /clients/{id}/income-composition; apresentação na identidade Lizard.

import React from 'react';
import { TOKENS, I } from './tokens.js';
import Icon from './components/Icon.jsx';
import Badge from './components/Badge.jsx';
import Card from './components/Card.jsx';
import StepNumber from './components/StepNumber.jsx';
import Sidebar from './components/Sidebar.jsx';
import AsyncScreen from './components/AsyncScreen.jsx';
import InfoTip from './components/InfoTip.jsx';
import { useIncomeComposition } from './hooks/useIncomeComposition';
import { useClientData } from './hooks/useClientData';
import { useAuth } from './hooks/useAuth';
import { clientsApi } from './services/api';
import { exportConsolidado } from './services/exportExcel.js';
import { exportExtratoPdf } from './services/exportPdf.js';
import { fmtBRL as fmt } from './lib/format';
import { confTone, mapMonth, groupDetail, computeRecurringIncome, receitaTrimestral, recurringDetailByMonth, statementWindow } from './services/domain';

// ─── Tela: Composição da renda verificada ───────────────────────────────────

export default function ScreenComposicao({ clientId, onVoltar, onNavigate }) {
  const { logout } = useAuth();
  const { data, loading, error, retry } = useIncomeComposition(clientId, statementWindow());
  const { data: clientData, loading: clientLoading } = useClientData(clientId);
  const [exportError, setExportError] = React.useState(null);

  React.useEffect(() => {
    if (clientData.syncPerformed) retry();
  }, [clientData.syncPerformed, retry]);

  if (loading || error) {
    return (
      <AsyncScreen
        loading={loading}
        error={error}
        loadingMessage="Carregando composição da renda..."
        errorTitle="Erro ao carregar composição"
        onRetry={retry}
        secondaryLabel="Voltar para análise"
        onSecondary={onVoltar}
        sidebarProps={{ activeItem: 'Clientes', onNavigate, onLogout: logout }}
      />
    );
  }

  const detailByMonth = {};
  (data?.detail || []).forEach((l) => {
    (detailByMonth[l.yearMonth] = detailByMonth[l.yearMonth] || []).push(l);
  });
  const meses = (data?.months || []).map((mo) => mapMonth(mo, detailByMonth[String(mo.yearMonth)] || []));
  const summary = data?.summary || { validatedIncomeAvg: 0, monthsAnalyzed: meses.length, recurringMonths: 0, confidence: 'Baixa' };
  const recurringByMonth = recurringDetailByMonth(data?.detail || [], meses);

  return (
    <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg }}>
      <Sidebar activeItem="Clientes" onNavigate={onNavigate} onLogout={logout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        <CompHeader
          onVoltar={onVoltar}
          exportDisabled={clientLoading}
          onExportExcel={async () => {
            setExportError(null);
            try {
              const statement = await clientsApi.getStatement(clientId, statementWindow());
              await exportConsolidado({
                client: clientData?.client,
                insights: clientData?.insights,
                income: data,
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
              const statement = await clientsApi.getStatement(clientId, statementWindow());
              exportExtratoPdf(clientData?.client, statement);
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
        {meses.length === 0 ? (
          <div style={{ padding: '48px 32px' }}>
            <Card>
              <div style={{ textAlign: 'center', padding: '32px 16px', color: TOKENS.textMuted }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.text, marginBottom: 6 }}>
                  Sem créditos para compor a renda
                </div>
                <p style={{ fontSize: 13, margin: 0 }}>
                  Este cliente ainda não possui transações de crédito sincronizadas via Open Finance no período.
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '0 32px 40px' }}>
            <SectionBand n={1}>
              <ResumoComposicao meses={meses} summary={summary} detail={data?.detail || []} insights={clientData?.insights} />
            </SectionBand>
            <SectionBand n={2}>
              <CompMensal meses={meses} recurringByMonth={recurringByMonth} />
            </SectionBand>
            <SectionBand n={3}>
              <DetalhamentoMeses meses={meses} detailByMonth={detailByMonth} recurringByMonth={recurringByMonth} />
            </SectionBand>
            <SectionBand n={4}>
              <CriterioCard />
            </SectionBand>
            <SectionBand n={5}>
              <LeituraOperacional onVoltar={onVoltar} />
            </SectionBand>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── Envelope de seção (fundo intercalado ímpar/par) ─────────
function SectionBand({ n, children }) {
  const isOdd = n % 2 === 1;
  return (
    <div style={{
      background: isOdd ? TOKENS.primarySoft : TOKENS.surface,
      borderRadius: 12,
      padding: '20px 24px',
    }}>
      {children}
    </div>
  );
}

// ───────── Header (with breadcrumb + export actions) ─────────
function CompHeader({ onVoltar, onExportExcel, onExportPdf, exportDisabled = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '24px 32px 18px', gap: 24, borderBottom: `1px solid ${TOKENS.border}`,
      background: TOKENS.surface,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onVoltar?.(); }} className="lz-link" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: TOKENS.textMuted, fontSize: 12.5, textDecoration: 'none', marginBottom: 8,
        }}>
          <Icon d={I.chevLeft} size={14} stroke={TOKENS.textMuted} />
          Voltar para análise do cliente
        </a>
        <h1 style={{
          margin: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          Composição da renda verificada
          <Badge tone="blue" size="sm" dot>Open Finance</Badge>
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: TOKENS.textMuted }}>
          Classificação dos créditos identificados via Open Finance no período analisado.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onExportExcel} disabled={exportDisabled}
          title={exportDisabled ? 'Aguardando dados do cliente...' : undefined}
          className="lz-btn-ghost" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: TOKENS.text,
            opacity: exportDisabled ? 0.5 : 1, cursor: exportDisabled ? 'wait' : 'pointer',
          }}>
          <Icon d={I.download} size={15} stroke={TOKENS.success} strokeWidth={1.8} />
          Exportar Excel
        </button>
        <button onClick={onExportPdf} disabled={exportDisabled}
          title={exportDisabled ? 'Aguardando dados do cliente...' : undefined}
          className="lz-btn-ghost" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: TOKENS.text,
            opacity: exportDisabled ? 0.5 : 1, cursor: exportDisabled ? 'wait' : 'pointer',
          }}>
          <Icon d={I.doc} size={15} stroke={TOKENS.danger} strokeWidth={1.8} />
          Exportar PDF
        </button>
      </div>
    </div>
  );
}

// ───────── 1. Resumo da composição ─────────
function ResumoComposicao({ meses, summary, detail, insights }) {
  const sum = (k) => meses.reduce((a, m) => a + m[k], 0);
  const mesesRecebidos = summary.monthsAnalyzed || meses.length || 1;
  const rendaRecorrente = React.useMemo(() => computeRecurringIncome(detail), [detail]);
  const trimestre = React.useMemo(() => receitaTrimestral(meses.filter((m) => !m.parcial)), [meses]);
  const patrimonioInvestido = insights?.totalAssets != null ? parseFloat(insights.totalAssets) : null;
  // Ordem de exibição definida pelo produto: 1, 8, 7, 6, 4, 5, 2, 3
  const items = [
    { l: 'Receita média', v: fmt(sum('receita') / mesesRecebidos), s: `Média mensal (${summary.monthsAnalyzed}m)`, icon: I.wallet, tone: 'blue', mono: true,
      info: 'Receita do período (exceto transferências entre contas) dividida pelos meses recebidos via Open Finance.' },
    { l: 'Receita total', v: fmt(sum('receita')), s: 'Soma do período', icon: I.chart, tone: 'success', mono: true,
      info: 'Soma da receita do período, exceto transferências entre contas do titular.' },
    { l: 'Receita trimestral', v: fmt(trimestre), s: 'Últimos 3 meses', icon: I.history, tone: 'warning', mono: true,
      info: 'Receita recebida nos últimos 3 meses analisados, exceto transferências entre contas.' },
    { l: 'Renda recorrente', v: fmt(rendaRecorrente.total), s: 'No período', icon: I.send, tone: 'blue', mono: true,
      info: 'Créditos classificados como renda recorrente pelo backend: pagador presente em 4 ou mais meses distintos, ou PIX recorrente validável. Mesma definição da renda validada e da aba de Auditoria do Excel.' },
    { l: 'Entre contas', v: fmt(sum('ent')), s: 'No período', icon: I.link, tone: 'purple', mono: true,
      info: 'Transferências entre contas da mesma titularidade identificadas no período; não representam nova geração de renda.' },
    { l: 'Créditos atípicos', v: fmt(sum('atip')), s: 'Removidos da média', icon: I.alert, tone: 'danger', mono: true,
      info: 'Créditos fora do padrão (ex.: estornos, resgates de investimento) excluídos do cálculo da renda validada.' },
    { l: 'Receita recorrente', v: `${summary.recurringMonths} / ${summary.monthsAnalyzed}`, s: 'Meses identificados', icon: I.refresh, tone: 'success', mono: true,
      info: 'Quantidade de meses com receita recorrente identificada em relação ao total de meses analisados.' },
    { l: 'Investimentos', v: patrimonioInvestido != null ? fmt(patrimonioInvestido) : '—', s: 'Patrimônio investido', icon: I.chart, tone: 'purple', mono: true,
      info: 'Montante total do patrimônio investido do cliente identificado via Open Finance (fundos, renda fixa, renda variável e tesouro), na última sincronização.' },
  ];
  const tonesMap = {
    blue: { bg: TOKENS.primarySoft, fg: TOKENS.primary },
    success: { bg: TOKENS.successSoft, fg: TOKENS.success },
    warning: { bg: TOKENS.warningSoft, fg: TOKENS.warning },
    danger: { bg: TOKENS.dangerSoft, fg: TOKENS.danger },
    purple: { bg: TOKENS.purpleSoft, fg: TOKENS.purple },
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={1} />
        <span style={{ fontSize: 17, fontWeight: 700, color: TOKENS.title, letterSpacing: -0.2 }}>Resumo da composição</span>
        <span style={{ fontSize: 12, color: TOKENS.textMuted }}>(8 indicadores · {summary.monthsAnalyzed} meses)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {items.map((f, i) => {
          const t = tonesMap[f.tone] ?? tonesMap.blue;
          return (
            <div key={i} className="lz-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, background: t.bg, color: t.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon d={f.icon} size={14} stroke={t.fg} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 11.5, color: TOKENS.textMuted, fontWeight: 500, lineHeight: 1.25 }}>
                  {f.l}
                </div>
                <InfoTip text={f.info} />
              </div>
              {f.isBadge ? (
                <div style={{ marginTop: 4 }}><Badge tone={f.badgeTone} size="md" dot>{f.v}</Badge></div>
              ) : (
                <div className={f.mono ? 'num' : ''} style={{ fontSize: 20, fontWeight: 600, color: TOKENS.text, letterSpacing: -0.4 }}>
                  {f.v}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: TOKENS.textSubtle, marginTop: 4 }}>{f.s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────── 2. Composição mensal da renda (tabela ampla) ─────────
function CompMensal({ meses, recurringByMonth }) {
  const [open, setOpen] = React.useState(true);
  const cols = [
    { id: 'mes', label: 'Mês', align: 'left' },
    { id: 'total', label: 'Total de entradas', align: 'right' },
    { id: 'ent', label: 'Entre contas (PF)', align: 'right' },
    { id: 'pixTotal', label: 'PIX recebido', align: 'right' },
    { id: 'recorrente', label: 'Renda Recorrente', align: 'right' },
    { id: 'entryCount', label: 'Número de entradas', align: 'center' },
    { id: 'avgEntry', label: 'Valor médio de entrada', align: 'center' },
    { id: 'maxEntry', label: 'Maior entrada', align: 'center' },
    { id: 'ver', label: 'Detalhes', align: 'center' },
  ];
  // Renda recorrente identificada em cada mês (mesmo critério do grupo "C. Renda
  // Recorrente" do detalhamento), somada aqui apenas para exibição na coluna da tabela.
  const recorrenteByMonth = {};
  meses.forEach((m) => {
    recorrenteByMonth[m.id] = (recurringByMonth?.[m.id] || []).reduce((a, r) => a + r.val, 0);
  });
  const totalGeral = meses.reduce((a, m) => a + m.total, 0);
  const entGeral = meses.reduce((a, m) => a + m.ent, 0);
  const pixGeral = meses.reduce((a, m) => a + m.pixTotal, 0);
  const recorrenteGeral = meses.reduce((a, m) => a + recorrenteByMonth[m.id], 0);
  const entriesGeral = meses.reduce((a, m) => a + m.entryCount, 0);
  const avgGeral = entriesGeral > 0 ? totalGeral / entriesGeral : 0;
  const maxGeral = meses.reduce((a, m) => Math.max(a, m.maxEntry), 0);
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4,
        background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left',
      }}>
        <StepNumber n={2} />
        <span style={{ fontSize: 17, fontWeight: 700, color: TOKENS.title, letterSpacing: -0.2 }}>Composição mensal da renda</span>
        <div style={{
          width: 24, height: 24, borderRadius: 7, background: TOKENS.primarySoft,
          color: TOKENS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s',
        }}>
          <Icon d={I.chevRight} size={13} stroke={TOKENS.primary} strokeWidth={2} />
        </div>
      </button>
      <p style={{ margin: '0 0 12px 32px', fontSize: 12.5, color: TOKENS.textMuted, maxWidth: 760 }}>
        Composição dos créditos identificados em cada mês e o valor efetivamente considerado para a renda validada.
      </p>
      {open && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: TOKENS.brandLight, borderBottom: `1px solid ${TOKENS.brandLight}` }}>
                  {cols.map((c) => (
                    <th key={c.id} style={{
                      padding: '11px 14px', textAlign: c.align, fontWeight: 700,
                      color: '#FFFFFF', fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: 0.4, whiteSpace: 'nowrap',
                    }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.id} className="lz-row-hover lz-row-zebra" style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: TOKENS.text }}>{m.parcial ? `${m.label} (parcial)` : m.label}</td>
                    <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: TOKENS.text }}>{fmt(m.total)}</td>
                    <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: TOKENS.textMuted }}>{fmt(m.ent)}</td>
                    <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: m.pixTotal ? TOKENS.primary : TOKENS.textSubtle }}>{fmt(m.pixTotal)}</td>
                    <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: recorrenteByMonth[m.id] ? TOKENS.success : TOKENS.textSubtle }}>{fmt(recorrenteByMonth[m.id])}</td>
                    <td className="num" style={{ padding: '12px 14px', textAlign: 'center', color: TOKENS.textMuted }}>{m.entryCount}</td>
                    <td className="num" style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: TOKENS.text, background: TOKENS.primarySoft + '55' }}>{fmt(m.avgEntry)}</td>
                    <td className="num" style={{ padding: '12px 14px', textAlign: 'center', color: TOKENS.text }}>{fmt(m.maxEntry)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <a href={`#${m.id}`} className="lz-link" style={{ fontSize: 12, color: TOKENS.primary, textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        Ver detalhes <Icon d={I.chevRight} size={12} stroke={TOKENS.primary} />
                      </a>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: TOKENS.panel }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: TOKENS.text, fontSize: 12 }}>Total {meses.length}m</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: TOKENS.text }}>{fmt(totalGeral)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: TOKENS.text }}>{fmt(entGeral)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: TOKENS.text }}>{fmt(pixGeral)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: TOKENS.success }}>{fmt(recorrenteGeral)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: TOKENS.text }}>{entriesGeral}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: TOKENS.primaryFg, background: TOKENS.primarySoft }}>{fmt(avgGeral)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: TOKENS.text }}>{fmt(maxGeral)}</td>
                  <td style={{ padding: '12px 14px' }} />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ───────── 3. Detalhamento dos créditos por mês ─────────
const METHOD_TONE = {
  PIX: 'blue',
  TED: 'purple',
  DOC: 'neutral',
  Boleto: 'warning',
  Resgate: 'neutral',
  Outros: 'neutral',
};

// Colunas padrão dos grupos A/B (lançamentos do próprio mês) e colunas do grupo
// C, que acrescenta o status da recorrência (ativa há N meses, ou período em
// que esteve ativa e já encerrou) a cada lançamento identificado como renda
// recorrente.
const DEFAULT_COLUMNS = [
  { key: 'd', label: 'Data' },
  { key: 'desc', label: 'Descrição' },
  { key: 'inst', label: 'Origem' },
  { key: 'val', label: 'Valor', align: 'right' },
  { key: 'met', label: 'Método de recebimento' },
];
const RECURRING_COLUMNS = [...DEFAULT_COLUMNS, { key: 'statusLabel', label: 'Status' }];

function DetalhamentoMeses({ meses, detailByMonth, recurringByMonth }) {
  const [open, setOpen] = React.useState(() => {
    const init = {};
    meses.forEach((m, i) => { init[m.id] = i === 0; });
    return init;
  });
  // Ordem de exibição dos cards de mês: 'asc' mostra do mais antigo para o mais
  // recente (passado → presente); 'desc' inverte, do mais recente para o mais
  // antigo (presente → passado). Não altera a ordem usada nas demais seções.
  const [order, setOrder] = React.useState('asc');
  const allOpen = meses.length > 0 && meses.every((m) => open[m.id]);
  const mesesOrdenados = React.useMemo(() => {
    const sorted = [...meses].sort((a, b) => a.id.localeCompare(b.id));
    return order === 'asc' ? sorted : sorted.reverse();
  }, [meses, order]);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={3} />
        <span style={{ fontSize: 17, fontWeight: 700, color: TOKENS.title, letterSpacing: -0.2 }}>Detalhamento dos créditos por mês</span>
        <span style={{ fontSize: 12, color: TOKENS.textMuted }}>(clique em um mês para expandir)</span>
        <div style={{ flex: 1 }} />
        <button
          className="lz-btn-ghost"
          onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          title="Alternar ordem cronológica do histórico de meses"
          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icon
            d={I.history}
            size={13}
            stroke={TOKENS.textMuted}
            strokeWidth={1.8}
          />
          {order === 'asc' ? 'Mais recente primeiro' : 'Mais antigo primeiro'}
        </button>
        <button className="lz-btn-ghost" onClick={() => {
          const next = {}; meses.forEach((m) => { next[m.id] = !allOpen; });
          setOpen(next);
        }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
          {allOpen ? 'Recolher todos' : 'Expandir todos'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mesesOrdenados.map((m) => (
          <MesDetail
            key={m.id}
            mes={m}
            lines={detailByMonth[m.id]}
            recurringLines={recurringByMonth[m.id]}
            open={open[m.id]}
            onToggle={() => setOpen((current) => ({ ...current, [m.id]: !current[m.id] }))}
          />
        ))}
      </div>
    </div>
  );
}

const MesDetail = React.memo(function MesDetail({ mes, lines, recurringLines, open, onToggle }) {
  // Lançamentos já exibidos no grupo "C. Renda Recorrente" são retirados da
  // listagem genérica do grupo "A. Receita" para não aparecer duplicados nos
  // dois grupos ao mesmo tempo.
  const recurringRawSet = React.useMemo(() => new Set((recurringLines || []).map((r) => r.raw)), [recurringLines]);
  const groups = React.useMemo(() => (
    groupDetail((lines || []).filter((l) => !recurringRawSet.has(l)))
  ), [lines, recurringRawSet]);
  return (
    <div className="lz-card" id={mes.id} style={{ overflow: 'hidden' }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px', background: 'transparent', border: 0, textAlign: 'left',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: TOKENS.primarySoft,
          color: TOKENS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s',
        }}>
          <Icon d={I.chevRight} size={14} stroke={TOKENS.primary} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text }}>{mes.long}</span>
          <span style={{ fontSize: 12, color: TOKENS.textMuted }}>
            Total créditos: <span className="num" style={{ color: TOKENS.text, fontWeight: 500 }}>{fmt(mes.total)}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge tone={confTone(mes.conf)} size="sm" dot>Confiança {mes.conf}</Badge>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: `1px solid ${TOKENS.border}` }}>
          {Object.entries(groups).map(([key, g]) => (
            <DetailGroup key={key} title={g.title} items={g.items} />
          ))}
          <DetailGroup title="C. Renda Recorrente" items={recurringLines || []} columns={RECURRING_COLUMNS} />
        </div>
      )}
    </div>
  );
});

function recurringGroupCellStyle(col) {
  const style = { padding: '10px 14px' };
  if (col.align === 'right') style.textAlign = 'right';
  if (col.key === 'd') style.color = TOKENS.text;
  if (col.key === 'desc') { style.color = TOKENS.text; style.fontWeight = 500; }
  if (col.key === 'inst') style.color = TOKENS.textMuted;
  if (col.key === 'val') { style.color = TOKENS.text; style.fontWeight = 600; }
  return style;
}

function DetailGroup({ title, items, columns = DEFAULT_COLUMNS }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: TOKENS.title, marginBottom: 8, letterSpacing: -0.1 }}>
        {title} <span style={{ color: TOKENS.textSubtle, fontWeight: 500 }}>· {items.length} {items.length === 1 ? 'lançamento' : 'lançamentos'}</span>
      </div>
      {items.length === 0 ? (
        <div style={{
          padding: '14px 16px', border: `1px dashed ${TOKENS.border}`, borderRadius: 10,
          fontSize: 12, color: TOKENS.textSubtle, fontStyle: 'italic',
        }}>
          Nenhum lançamento identificado neste mês.
        </div>
      ) : (
        <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: TOKENS.brandLight, borderBottom: `1px solid ${TOKENS.brandLight}` }}>
                {columns.map((c) => (
                  <th key={c.key} style={{
                    padding: '9px 14px', textAlign: c.align === 'right' ? 'right' : 'left',
                    fontWeight: 700, color: '#FFFFFF', fontSize: 12,
                    textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
                  }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="lz-row-hover" style={{ borderBottom: i < items.length - 1 ? `1px solid ${TOKENS.border}` : 'none' }}>
                  {columns.map((c) => {
                    if (c.key === 'met') {
                      return (
                        <td key={c.key} style={recurringGroupCellStyle(c)}>
                          <Badge tone={METHOD_TONE[it.met] || 'neutral'} size="sm" dot>{it.met}</Badge>
                        </td>
                      );
                    }
                    if (c.key === 'statusLabel') {
                      return (
                        <td key={c.key} style={recurringGroupCellStyle(c)}>
                          <Badge tone={it.statusOngoing ? 'blue' : 'neutral'} size="sm" dot>{it.statusLabel}</Badge>
                        </td>
                      );
                    }
                    if (c.key === 'val') {
                      return (
                        <td key={c.key} className="num" style={recurringGroupCellStyle(c)}>{fmt(it.val)}</td>
                      );
                    }
                    return (
                      <td key={c.key} className={c.key === 'd' ? 'num' : undefined} style={recurringGroupCellStyle(c)}>{it[c.key]}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ───────── 4. Critério utilizado na composição da renda ─────────
function CriterioCard() {
  const bullets = [
    { l: 'Receita recorrente mensal', v: 'entra na renda validada', tone: 'success' },
    { l: 'Renda recorrente', v: 'pagador presente em 4+ meses distintos ou PIX recorrente validável (classificação do backend)', tone: 'blue' },
    { l: 'Transferência entre contas', v: 'não entra', tone: 'neutral' },
    { l: 'Entrada não recorrente', v: 'normalmente não entra', tone: 'warning' },
    { l: 'Crédito atípico / excluído', v: 'não entra', tone: 'danger' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={4} />
        <span style={{ fontSize: 17, fontWeight: 700, color: TOKENS.title, letterSpacing: -0.2 }}>Critério utilizado na composição da renda</span>
      </div>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: TOKENS.primarySoft,
              color: TOKENS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon d={I.info} size={16} stroke={TOKENS.primary} strokeWidth={1.8} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: TOKENS.text, lineHeight: 1.65, textWrap: 'pretty' }}>
              A renda verificada é composta prioritariamente por créditos com padrão recorrente mensal
              identificados no histórico bancário do cliente. Transferências entre contas da mesma
              titularidade são separadas por não representarem nova geração de renda. PIX e transferências
              de terceiros são avaliados conforme recorrência, origem e estabilidade. Entradas não
              recorrentes, reembolsos, estornos e créditos atípicos permanecem visíveis para auditoria,
              mas não compõem a renda recorrente principal.
            </p>
          </div>
          <div style={{
            background: TOKENS.panel, border: `1px solid ${TOKENS.border}`, borderRadius: 10,
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
              Regras aplicadas
            </div>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5 }}>
                <Badge tone={b.tone} size="sm" dot>{b.l}</Badge>
                <span style={{ color: TOKENS.textMuted, flex: 1, paddingTop: 2 }}>{b.v}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ───────── 5. Leitura operacional ─────────
function LeituraOperacional({ onVoltar }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={5} />
        <span style={{ fontSize: 17, fontWeight: 700, color: TOKENS.title, letterSpacing: -0.2 }}>Leitura operacional</span>
      </div>
      <div className="lz-card" style={{
        padding: 18,
        background: `linear-gradient(180deg, ${TOKENS.primarySoft}55 0%, white 70%)`,
        border: `1px solid ${TOKENS.primarySoft}`,
      }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: TOKENS.success,
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon d={I.shieldCheck} size={18} stroke="white" strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.text, marginBottom: 6 }}>
              Composição calculada a partir dos créditos sincronizados
            </div>
            <p style={{ margin: 0, fontSize: 13, color: TOKENS.text, lineHeight: 1.6, textWrap: 'pretty' }}>
              A renda validada foi calculada a partir dos créditos recorrentes identificados no período,
              com exclusão de transferências internas e entradas atípicas. Revise o detalhamento por mês
              para auditar cada lançamento considerado.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                className="lz-btn-primary"
                onClick={onVoltar}
                style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
              >
                Voltar para análise do cliente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
