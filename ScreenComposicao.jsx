// Tela de composição da renda verificada: resumo, tabela mensal, detalhamento de
// créditos por mês, critérios e leitura operacional. Consome o endpoint
// /clients/{id}/income-composition; apresentação na identidade Lizard.

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
import { confTone, mapMonth, groupDetail } from './services/domain';

// ─── Tela: Composição da renda verificada ───────────────────────────────────

export default function ScreenComposicao({ clientId, onVoltar, onNavigate }) {
  const { logout } = useAuth();
  const { data, loading, error, retry } = useIncomeComposition(clientId);
  const { data: clientData, loading: clientLoading } = useClientData(clientId);
  const [exportError, setExportError] = React.useState(null);

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
              const statement = await clientsApi.getStatement(clientId);
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
              const statement = await clientsApi.getStatement(clientId);
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
            <ResumoComposicao meses={meses} summary={summary} />
            <CompMensal meses={meses} />
            <DetalhamentoMeses meses={meses} detailByMonth={detailByMonth} />
            <CriterioCard />
            <LeituraOperacional onVoltar={onVoltar} />
          </div>
        )}
      </div>
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
          margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: TOKENS.title,
          display: 'flex', alignItems: 'center', gap: 10,
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
function ResumoComposicao({ meses, summary }) {
  const sum = (k) => meses.reduce((a, m) => a + m[k], 0);
  const mesesRecebidos = summary.monthsAnalyzed || meses.length || 1;
  const items = [
    { l: 'Receita média', v: fmt(sum('total') / mesesRecebidos), s: `Média mensal (${summary.monthsAnalyzed}m)`, icon: I.wallet, tone: 'blue', mono: true,
      info: 'Total de entradas do período (inclui transferências entre contas) dividido pelos meses recebidos via Open Finance.' },
    { l: 'Receita recorrente', v: `${summary.recurringMonths} / ${summary.monthsAnalyzed}`, s: 'Meses identificados', icon: I.refresh, tone: 'success', mono: true,
      info: 'Quantidade de meses com receita recorrente identificada em relação ao total de meses analisados.' },
    { l: 'Confiança da análise', v: summary.confidence, s: 'Padrão dos créditos', icon: I.shieldCheck, tone: confTone(summary.confidence), isBadge: true, badgeTone: confTone(summary.confidence),
      info: 'Nível de confiança da classificação, com base no padrão e na estabilidade dos créditos identificados no período.' },
    { l: 'Créditos atípicos', v: fmt(sum('atip')), s: 'Removidos da média', icon: I.alert, tone: 'danger', mono: true,
      info: 'Créditos fora do padrão (ex.: estornos, resgates de investimento) excluídos do cálculo da renda validada.' },
    { l: 'Entre contas', v: fmt(sum('ent')), s: 'No período', icon: I.link, tone: 'purple', mono: true,
      info: 'Transferências entre contas da mesma titularidade identificadas no período; não representam nova geração de renda.' },
    { l: 'Não recorrentes', v: fmt(sum('nrec')), s: 'No período', icon: I.history, tone: 'warning', mono: true,
      info: 'Entradas sem padrão de recorrência no período; normalmente não compõem a renda validada.' },
    { l: 'PIX recorrente validável', v: fmt(sum('pix')), s: 'No período', icon: I.send, tone: 'blue', mono: true,
      info: 'PIX com padrão recorrente que podem entrar na renda validada quando houver consistência de origem e valor.' },
    { l: 'Receita total', v: fmt(sum('total')), s: 'Soma do período', icon: I.chart, tone: 'success', mono: true,
      info: 'Soma de todas as entradas do período, incluindo transferências entre contas.' },
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
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Resumo da composição</span>
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
function CompMensal({ meses }) {
  const cols = [
    { id: 'mes', label: 'Mês', align: 'left' },
    { id: 'total', label: 'Total de entradas', align: 'right' },
    { id: 'ent', label: 'Entre contas (PF)', align: 'right' },
    { id: 'pixTotal', label: 'PIX recebido', align: 'right' },
    { id: 'entryCount', label: 'Número de entradas', align: 'right' },
    { id: 'avgEntry', label: 'Valor médio de entrada', align: 'right' },
    { id: 'maxEntry', label: 'Maior entrada', align: 'right' },
    { id: 'ver', label: 'Detalhes', align: 'right' },
  ];
  const totalGeral = meses.reduce((a, m) => a + m.total, 0);
  const entGeral = meses.reduce((a, m) => a + m.ent, 0);
  const pixGeral = meses.reduce((a, m) => a + m.pixTotal, 0);
  const entriesGeral = meses.reduce((a, m) => a + m.entryCount, 0);
  const avgGeral = entriesGeral > 0 ? totalGeral / entriesGeral : 0;
  const maxGeral = meses.reduce((a, m) => Math.max(a, m.maxEntry), 0);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <StepNumber n={2} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Composição mensal da renda</span>
      </div>
      <p style={{ margin: '0 0 12px 32px', fontSize: 12.5, color: TOKENS.textMuted, maxWidth: 760 }}>
        Composição dos créditos identificados em cada mês e o valor efetivamente considerado para a renda validada.
      </p>
      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: TOKENS.panel, borderBottom: `1px solid ${TOKENS.border}` }}>
                {cols.map((c) => (
                  <th key={c.id} style={{
                    padding: '11px 14px', textAlign: c.align, fontWeight: 600,
                    color: TOKENS.textMuted, fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: 0.4, whiteSpace: 'nowrap',
                  }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.id} className="lz-row-hover lz-row-zebra" style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: TOKENS.text }}>{m.label}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: TOKENS.text }}>{fmt(m.total)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: TOKENS.textMuted }}>{fmt(m.ent)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: m.pixTotal ? TOKENS.primary : TOKENS.textSubtle }}>{fmt(m.pixTotal)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: TOKENS.textMuted }}>{m.entryCount}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: TOKENS.text, background: TOKENS.primarySoft + '55' }}>{fmt(m.avgEntry)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: TOKENS.text }}>{fmt(m.maxEntry)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <a href={`#${m.id}`} className="lz-link" style={{ fontSize: 12, color: TOKENS.primary, textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: TOKENS.text }}>{entriesGeral}</td>
                <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: TOKENS.primaryFg, background: TOKENS.primarySoft }}>{fmt(avgGeral)}</td>
                <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: TOKENS.text }}>{fmt(maxGeral)}</td>
                <td style={{ padding: '12px 14px' }} />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
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

function DetalhamentoMeses({ meses, detailByMonth }) {
  const [open, setOpen] = React.useState(() => {
    const init = {};
    meses.forEach((m, i) => { init[m.id] = i === 0; });
    return init;
  });
  const allOpen = meses.length > 0 && meses.every((m) => open[m.id]);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={3} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Detalhamento dos créditos por mês</span>
        <span style={{ fontSize: 12, color: TOKENS.textMuted }}>(clique em um mês para expandir)</span>
        <div style={{ flex: 1 }} />
        <button className="lz-btn-ghost" onClick={() => {
          const next = {}; meses.forEach((m) => { next[m.id] = !allOpen; });
          setOpen(next);
        }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
          {allOpen ? 'Recolher todos' : 'Expandir todos'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {meses.map((m) => (
          <MesDetail
            key={m.id}
            mes={m}
            lines={detailByMonth[m.id]}
            open={open[m.id]}
            onToggle={() => setOpen((current) => ({ ...current, [m.id]: !current[m.id] }))}
          />
        ))}
      </div>
    </div>
  );
}

const MesDetail = React.memo(function MesDetail({ mes, lines, open, onToggle }) {
  const groups = React.useMemo(() => groupDetail(lines), [lines]);
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
        </div>
      )}
    </div>
  );
});

function DetailGroup({ title, items }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text, marginBottom: 8, letterSpacing: -0.1 }}>
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
              <tr style={{ background: TOKENS.panel, borderBottom: `1px solid ${TOKENS.border}` }}>
                {['Data', 'Descrição', 'Origem', 'Valor', 'Método de recebimento'].map((h, i) => (
                  <th key={i} style={{
                    padding: '9px 14px', textAlign: i === 3 ? 'right' : 'left',
                    fontWeight: 600, color: TOKENS.textMuted, fontSize: 10.5,
                    textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="lz-row-hover" style={{ borderBottom: i < items.length - 1 ? `1px solid ${TOKENS.border}` : 'none' }}>
                  <td className="num" style={{ padding: '10px 14px', color: TOKENS.text }}>{it.d}</td>
                  <td style={{ padding: '10px 14px', color: TOKENS.text, fontWeight: 500 }}>{it.desc}</td>
                  <td style={{ padding: '10px 14px', color: TOKENS.textMuted }}>{it.inst}</td>
                  <td className="num" style={{ padding: '10px 14px', textAlign: 'right', color: TOKENS.text, fontWeight: 600 }}>{fmt(it.val)}</td>
                  <td style={{ padding: '10px 14px' }}><Badge tone={METHOD_TONE[it.met] || 'neutral'} size="sm" dot>{it.met}</Badge></td>
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
    { l: 'PIX recorrente validável', v: 'pode entrar quando houver consistência', tone: 'blue' },
    { l: 'Transferência entre contas', v: 'não entra', tone: 'neutral' },
    { l: 'Entrada não recorrente', v: 'normalmente não entra', tone: 'warning' },
    { l: 'Crédito atípico / excluído', v: 'não entra', tone: 'danger' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <StepNumber n={4} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Critério utilizado na composição da renda</span>
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
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Leitura operacional</span>
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
