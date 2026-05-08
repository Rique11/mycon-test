import React from 'react';
import { TOKENS, I } from './tokens.js';
import Icon from './components/Icon.jsx';
import Badge from './components/Badge.jsx';
import Card from './components/Card.jsx';
import StepNumber from './components/StepNumber.jsx';
import Avatar from './components/Avatar.jsx';
import Sidebar from './components/Sidebar.jsx';

// ───────── Dados do cliente ─────────
const CLIENTE = {
  nome: 'Larissa Teixeira',
  cpf: '●●●.●●●.321-10',
  grupo: '126 / 33',
  produto: 'Imóvel',
  status: 'pendente',
  ofConectado: true,
  ofConectadoEm: '22/05/2025 09:23',
  rendaDeclarada: 6800,
  rendaVerificada: 6450,
  diferenca: 350,
  divergencia: -5.1,
  variacao: 3.2,
  fontes: 1,
  atipicos: 420,
  confianca: 'Alta',
  dataAnalise: '22/05/2025 · 09:41',
  contemplacao: '17/05/2025',
  prioridade: 'Média',
  consultor: 'Carla Mendes',
  telefone: '(11) 98765-4321',
  email: 'larissa.teixeira@email.com',
};

const MESES_RENDA = [
  { m: 'Mar/25', v: 6200 },
  { m: 'Abr/25', v: 6280 },
  { m: 'Mai/25', v: 6600 },
  { m: 'Jun/25', v: 6500 },
  { m: 'Jul/25', v: 6470 },
  { m: 'Ago/25', v: 6650 },
];

function fmtBRL(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ───────── Tela principal ─────────
export default function ScreenCliente({ onVerComposicao }) {
  return (
    <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <PageHeader dataAnalise={CLIENTE.dataAnalise} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 48px' }}>
          <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 24 }}>
            <ContextoCliente cliente={CLIENTE} />
            <ResumoVisual cliente={CLIENTE} />
            <Evidencias cliente={CLIENTE} onVerComposicao={onVerComposicao} />
            <ExplicacaoOperador cliente={CLIENTE} />
            <DecisaoSugerida cliente={CLIENTE} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── Header da página ─────────
function PageHeader({ dataAnalise }) {
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
        <button className="lz-btn-ghost" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', fontSize: 13, fontWeight: 500, color: TOKENS.textMuted,
        }}>
          <Icon d={I.arrowLeft} size={14} stroke={TOKENS.textMuted} strokeWidth={1.8} />
          Voltar para contemplados
        </button>
        <span style={{ color: TOKENS.borderStrong }}>·</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Cliente contemplado</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: TOKENS.textMuted,
          background: TOKENS.panel, border: `1px solid ${TOKENS.border}`,
          padding: '4px 10px', borderRadius: 8,
        }}>
          <kbd style={{ fontFamily: 'inherit', fontSize: 11 }}>⌘K</kbd>
        </span>
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
            <Avatar name={cliente.nome} size={44} tone="blue" />
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
            <Badge tone="warning" size="sm" dot>{cliente.status}</Badge>
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
            <a href="#composicao" className="lz-link" style={{ fontSize: 11.5, fontWeight: 500 }}>
              Ver detalhes
            </a>
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
function ResumoVisual({ cliente }) {
  const kpis = [
    {
      label: 'Renda verificada', value: fmtBRL(cliente.rendaVerificada),
      sub: 'Média mensal (6m)', tone: 'blue', icon: I.wallet, mono: true,
    },
    {
      label: 'Estabilidade', value: 'Alta',
      sub: 'Baixa variação', tone: 'success', icon: I.shieldCheck, isBadge: true, badgeTone: 'success',
    },
    {
      label: 'Fontes recorrentes', value: `${cliente.fontes} fonte`,
      sub: 'Salário identificado', tone: 'success', icon: I.refresh, mono: false,
    },
    {
      label: 'Divergência', value: `${cliente.divergencia}%`,
      sub: `Diferença de R$ ${cliente.diferenca}`, tone: 'warning', icon: I.alert, mono: true,
    },
    {
      label: 'Inconsistência', value: 'Baixo',
      sub: 'Confiança alta', tone: 'success', icon: I.chart, isBadge: true, badgeTone: 'success',
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1.4fr', gap: 12 }}>
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
          background: `linear-gradient(135deg, ${TOKENS.successSoft} 0%, #fff 100%)`,
          border: `1px solid ${TOKENS.success}33`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, background: TOKENS.success,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon d={I.shieldCheck} size={13} stroke="#fff" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 500 }}>Recomendação</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: TOKENS.success, lineHeight: 1.3 }}>
            Aprovar comprovação de renda
          </div>
          <div style={{ fontSize: 10.5, color: TOKENS.textMuted, marginTop: 5 }}>
            Baseado nas evidências analisadas
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── 3. Evidências ─────────
function Evidencias({ cliente, onVerComposicao }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <StepNumber n={3} />
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>Evidências</span>
        <Badge tone="blue" size="sm" dot>agregado · Open Finance</Badge>
      </div>
      <p style={{ margin: '0 0 12px 32px', fontSize: 12.5, color: TOKENS.textMuted }}>
        Créditos identificados via Open Finance nos últimos 6 meses.
      </p>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <EvidKpi label="Salário recorrente" value="Sim" sub="Depósitos em dia útil" tone="success" />
          <EvidKpi label="Média 6 meses" value={fmtBRL(cliente.rendaVerificada)} sub="Mar a Ago/2025" mono />
          <EvidKpi label="Variação mensal" value={`${cliente.variacao}%`} sub="Coef. de variação" tone="warning" mono />
          <EvidKpi label="Créditos atípicos" value={fmtBRL(cliente.atipicos)} sub="Excluídos da média" tone="danger" mono />
        </div>

        {/* Chart */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>
                Evolução da renda verificada
              </div>
              <div style={{ fontSize: 11.5, color: TOKENS.textMuted }}>
                Média mensal · últimos 6 meses
              </div>
            </div>
            {onVerComposicao && (
              <button onClick={onVerComposicao} className="lz-btn-ghost" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', fontSize: 12, fontWeight: 500, color: TOKENS.primary,
              }}>
                <Icon d={I.link} size={13} stroke={TOKENS.primary} strokeWidth={1.8} />
                Ver composição detalhada
              </button>
            )}
          </div>
          <IncomeChart data={MESES_RENDA} />
        </div>
      </Card>
    </div>
  );
}

function EvidKpi({ label, value, sub, tone, mono = false }) {
  const colorMap = { success: TOKENS.success, warning: TOKENS.warning, danger: TOKENS.danger };
  const color = colorMap[tone] ?? TOKENS.text;
  return (
    <div style={{
      padding: '12px 14px', background: TOKENS.panel,
      border: `1px solid ${TOKENS.border}`, borderRadius: 10,
    }}>
      <div style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
        {label}
      </div>
      <div className={mono ? 'num' : ''} style={{ fontSize: 18, fontWeight: 700, color, letterSpacing: -0.3 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: TOKENS.textSubtle, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function IncomeChart({ data }) {
  const W = 560, H = 160;
  const pad = { top: 24, right: 16, bottom: 36, left: 52 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const maxV = 9000;
  const barW = (cW / data.length) * 0.5;
  const yLines = [0, 3000, 6000, 9000];

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
              {v === 0 ? 'R$ 0' : `R$ ${v / 1000}k`}
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
        const label = `R$ ${(d.v / 1000).toFixed(2).replace('.', ',')}k`;
        return (
          <g key={d.m}>
            <rect x={x} y={y} width={barW} height={barH} rx={3}
              fill={TOKENS.primary} opacity={0.85} />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={9} fill={TOKENS.textMuted}>
              {label}
            </text>
            <text x={x + barW / 2} y={H - pad.bottom + 14} textAnchor="middle" fontSize={10} fill={TOKENS.textMuted}>
              {d.m}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ───────── 4. Explicação para o operador ─────────
function ExplicacaoOperador({ cliente }) {
  const rows = [
    { l: 'Renda declarada',   v: fmtBRL(cliente.rendaDeclarada),  mono: true, color: TOKENS.text },
    { l: 'Renda verificada',  v: fmtBRL(cliente.rendaVerificada), mono: true, color: TOKENS.primary },
    { l: 'Diferença',         v: fmtBRL(cliente.diferenca),       mono: true, color: TOKENS.textMuted },
    { l: 'Divergência',       v: `${cliente.divergencia}%`,       mono: true, color: TOKENS.warning },
    { l: 'Confiança',         v: cliente.confianca,                mono: false, color: TOKENS.success },
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
              Identificamos <strong>{cliente.fontes} fonte</strong> de renda recorrente (salário) com depósitos
              regulares em dia útil. A variação mensal é baixa (<strong>{cliente.variacao}%</strong>) e a média
              verificada de <strong>{fmtBRL(cliente.rendaVerificada)}</strong> é compatível com a renda declarada
              de <strong>{fmtBRL(cliente.rendaDeclarada)}</strong>. Não foram identificados sinais relevantes de
              instabilidade ou inconsistência.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ───────── 5. Decisão sugerida ─────────
function DecisaoSugerida({ cliente }) {
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
            background: `linear-gradient(180deg, ${TOKENS.successSoft} 0%, #fff 80%)`,
            border: `1px solid ${TOKENS.success}33`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, background: TOKENS.success,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon d={I.shieldCheck} size={17} stroke="#fff" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.success, marginBottom: 4 }}>
                  Aprovar comprovação
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: TOKENS.text, lineHeight: 1.55 }}>
                  As evidências indicam renda recorrente e estável compatível com a renda declarada.
                </p>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="lz-btn-primary" style={{
              padding: '11px 20px', fontSize: 13.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Icon d={I.check} size={15} stroke="#fff" strokeWidth={2.5} />
              Aprovar comprovação de renda
            </button>
            <button className="lz-btn-ghost" style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 500, color: TOKENS.text,
            }}>
              Enviar para revisão manual
            </button>
            <button className="lz-btn-ghost" style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 500, color: TOKENS.text,
            }}>
              Solicitar complemento
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <a href="#" className="lz-link" style={{
              fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5,
              color: TOKENS.warning,
            }}>
              <Icon d={I.alert} size={13} stroke={TOKENS.warning} strokeWidth={1.8} />
              Risco de inconsistência
            </a>
          </div>
        </div>

        {/* Informações do cliente */}
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
            Informações do cliente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { l: 'Produto',             v: cliente.produto },
              { l: 'Grupo / Cota',        v: cliente.grupo, mono: true },
              { l: 'Data de contemplação',v: cliente.contemplacao, mono: true },
              { l: 'Prioridade',          v: cliente.prioridade },
              { l: 'Consultor',           v: cliente.consultor },
              { l: 'Telefone',            v: cliente.telefone, mono: true },
              { l: 'E-mail',              v: cliente.email },
            ].map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: 12, paddingBottom: 10,
                borderBottom: i < 6 ? `1px solid ${TOKENS.border}` : 'none',
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
