import React from 'react';
import { TOKENS, I, SHADOWS } from '../tokens.js';
import Sidebar from '../components/Sidebar.jsx';
import Icon from '../components/Icon.jsx';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import CaseDrawer from '../components/poc/CaseDrawer.jsx';
import NewCaseModal from '../components/poc/NewCaseModal.jsx';
import {
  PRODUCT_LABELS,
  POC_FILTERS,
  getQueueBusinessRules,
  getStatusMeta,
} from '../services/domain';
import { maskCpf } from '../lib/format';
import { usePocCases } from '../hooks/usePocCases.js';
import { useClientList } from '../hooks/useClientList';
import { buildQueueCases } from '../services/clientResolution.js';
import { getLocalBankLabels } from '../hooks/useCaseEvidence.js';

function countByFilter(cases, filter) {
  if (!filter.statuses) return cases.length;
  return cases.filter((item) => filter.statuses.includes(item.status)).length;
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CL';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function getFilteredCases(cases, filterKey, searchTerm) {
  const filter = POC_FILTERS.find((item) => item.key === filterKey) ?? POC_FILTERS[0];
  const term = searchTerm.trim().toLowerCase();

  return cases.filter((item) => {
    const statusOk = !filter.statuses || filter.statuses.includes(item.status);
    if (!statusOk) return false;
    if (!term) return true;

    return [
      item.externalCaseId,
      item.name,
      item.cpfMasked,
      item.cpf,
      item.group,
      item.quota,
      PRODUCT_LABELS[item.product],
      getStatusMeta(item.status).label,
    ].some((value) => String(value || '').toLowerCase().includes(term));
  });
}

function getPendingCases(cases) {
  const pendingFilter = POC_FILTERS.find((item) => item.key === 'pendencia');
  return cases
    .filter((item) => pendingFilter?.statuses?.includes(item.status))
    .slice(0, 6);
}

function getQueueBanksLabel(caseItem, queueRule, bankLabels = getLocalBankLabels(caseItem)) {
  if (bankLabels.length) return bankLabels.join(', ');
  return queueRule.accepted ? 'Banco nao identificado' : 'Aguardando consentimento';
}

export default function PocContempladosScreen({ onLogout, onNavigate, onSelectClient }) {
  const { cases, addCase, updateCase, nextCaseId } = usePocCases();
  const { clients, loading: clientsLoading, error: clientsError, retry: retryClients } = useClientList();
  const [activeFilter, setActiveFilter] = React.useState('todos');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showNewCase, setShowNewCase] = React.useState(false);
  const [selectedCase, setSelectedCase] = React.useState(null);
  const [caseCreatedInModal, setCaseCreatedInModal] = React.useState(null);

  const queueCases = React.useMemo(() => buildQueueCases(clients, cases), [clients, cases]);

  const filteredCases = React.useMemo(
    () => getFilteredCases(queueCases, activeFilter, searchTerm),
    [queueCases, activeFilter, searchTerm],
  );

  const metrics = React.useMemo(() => {
    const ready = queueCases.filter((item) => item.status === 'pronto').length;
    const connected = queueCases.filter((item) => item.status === 'conectado').length;
    const pending = countByFilter(queueCases, POC_FILTERS.find((item) => item.key === 'pendencia'));
    const waiting = countByFilter(queueCases, POC_FILTERS.find((item) => item.key === 'aguardando'));

    return [
      { label: 'Casos na fila', value: queueCases.length, note: 'Clientes da API + casos locais', tone: 'blue' },
      { label: 'Aguardando cliente', value: waiting, note: 'Consentimento enviado ou pendente', tone: 'warning' },
      { label: 'Open Finance conectado', value: connected, note: 'Coleta em andamento', tone: 'purple' },
      { label: 'Extratos prontos', value: ready, note: 'Pacote 12m gerado', tone: 'success' },
      { label: 'Pendências', value: pending, note: 'Casos que pedem ação', tone: 'danger' },
    ];
  }, [queueCases]);

  const pendingCases = React.useMemo(() => getPendingCases(queueCases), [queueCases]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg }}>
      <Sidebar activeItem="POC Contemplados" onNavigate={onNavigate} onLogout={onLogout} />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px 32px' }}>
          <section style={{ maxWidth: 1320, margin: '0 auto' }}>
            <Hero onCreate={() => setShowNewCase(true)} />
            <Pipeline />
            <MetricsGrid metrics={metrics} />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
              <CasesTable
                cases={filteredCases}
                allCases={queueCases}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onSelectCase={setSelectedCase}
                loading={clientsLoading}
                errorMessage={clientsError ? 'Não foi possível carregar os clientes da API.' : ''}
                onRetry={retryClients}
              />

              <OperationalFooter pendingCases={pendingCases} onSelectCase={setSelectedCase} />
            </div>
          </section>
        </div>
      </main>

      {showNewCase && (
        <NewCaseModal
          defaultCaseId={nextCaseId}
          existingCases={queueCases}
          onClose={() => {
            setShowNewCase(false);
            if (caseCreatedInModal) {
              setSelectedCase(caseCreatedInModal);
              setCaseCreatedInModal(null);
            }
          }}
          onCreated={(newCase) => {
            addCase(newCase);
            setCaseCreatedInModal(newCase);
          }}
        />
      )}

      {selectedCase && (
        <CaseDrawer
          caseItem={selectedCase}
          onClose={() => setSelectedCase(null)}
          onSelectClient={onSelectClient}
          onUpdateCase={(caseId, patch) => {
            updateCase(caseId, patch);
            setSelectedCase((current) => (current?.id === caseId ? { ...current, ...patch } : current));
          }}
        />
      )}
    </div>
  );
}

function Topbar() {
  return (
    <header style={{
      height: 68,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 20,
      padding: '0 30px',
      borderBottom: `1px solid ${TOKENS.border}`,
      background: TOKENS.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 12.5, color: TOKENS.textMuted }}>POC local + API Akropoli</span>
        <button className="lz-btn-ghost" style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={I.bell} size={16} stroke={TOKENS.textMuted} strokeWidth={1.8} />
        </button>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: TOKENS.brand,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
        }}>
          OM
        </div>
      </div>
    </header>
  );
}

function Hero({ onCreate }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 24,
      marginBottom: 18,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Badge tone="blue" size="md" dot>Mycon x Lizard</Badge>
          <span style={{ fontSize: 12, color: TOKENS.textMuted }}>Fila operacional de contemplados</span>
        </div>
        <h1 style={{ margin: 0, color: TOKENS.title, fontSize: 28, lineHeight: 1.15, letterSpacing: -0.4 }}>
          POC Open Finance - Contemplados
        </h1>
        <p style={{ margin: '8px 0 0', maxWidth: 760, color: TOKENS.textMuted, fontSize: 13.5, lineHeight: 1.55 }}>
          Cadastre o contemplado, gere o link de consentimento e acompanhe consentimento,
          coleta Open Finance, pendências e entrega do extrato financeiro 12m.
        </p>
      </div>

      <Button onClick={onCreate} size="lg" style={{ flexShrink: 0 }}>
        <Icon d={I.link} size={16} stroke="currentColor" strokeWidth={1.9} />
        Novo contemplado
      </Button>
    </div>
  );
}

function Pipeline() {
  const steps = [
    { n: 1, title: 'Cadastro', body: 'Dados do contemplado e cota' },
    { n: 2, title: 'Consentimento', body: 'Link Open Finance enviado' },
    { n: 3, title: 'Coleta 12m', body: 'Bancos conectados e extratos' },
    { n: 4, title: 'Entrega', body: 'Excel consolidado e evidencias' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
      gap: 12,
      marginBottom: 18,
    }}>
      {steps.map((step) => (
        <div key={step.n} style={{
          display: 'flex',
          gap: 11,
          alignItems: 'center',
          minHeight: 72,
          padding: '14px 16px',
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 12,
          background: TOKENS.surface,
        }}>
          <span style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: step.n === 1 ? TOKENS.primary : TOKENS.primarySoft,
            color: step.n === 1 ? '#fff' : TOKENS.primary,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}>{step.n}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: TOKENS.text }}>{step.title}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: TOKENS.textMuted, marginTop: 2 }}>{step.body}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricsGrid({ metrics }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
      marginBottom: 18,
    }}>
      {metrics.map((metric) => (
        <Card key={metric.label} padding="15px 16px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: TOKENS.textMuted, fontWeight: 600 }}>{metric.label}</span>
            <Badge tone={metric.tone} dot>{metric.tone === 'danger' ? 'Ação' : 'POC'}</Badge>
          </div>
          <div className="num" style={{ fontSize: 27, fontWeight: 700, color: TOKENS.title, lineHeight: 1 }}>
            {metric.value}
          </div>
          <div style={{ marginTop: 7, fontSize: 11.5, color: TOKENS.textSubtle, lineHeight: 1.35 }}>
            {metric.note}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CasesTable({ cases, allCases, activeFilter, onFilterChange, searchTerm, onSearchTermChange, onSelectCase, loading = false, errorMessage = '', onRetry }) {
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 18px',
        borderBottom: `1px solid ${TOKENS.border}`,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, color: TOKENS.title, letterSpacing: -0.2 }}>Fila operacional de casos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: TOKENS.textMuted }}>
            Regra principal: consentimento recente, consentimento pendente ou aceite pronto para acessar os outputs.
          </p>
        </div>
        <Badge tone="neutral" size="md">{cases.length} exibidos</Badge>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '12px 14px',
        borderBottom: `1px solid ${TOKENS.border}`,
        background: TOKENS.panel,
      }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: '1 1 520px', minWidth: 0 }}>
          {POC_FILTERS.map((filter) => {
            const active = filter.key === activeFilter;
            return (
              <button
                key={filter.key}
                onClick={() => onFilterChange(filter.key)}
                className={active ? 'lz-btn-primary' : 'lz-btn-ghost'}
                style={{
                  flexShrink: 0,
                  padding: '8px 11px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: active ? '#fff' : TOKENS.textMuted,
                  boxShadow: active ? SHADOWS.primary : 'none',
                }}
              >
                {filter.label}
                <span className="num" style={{ marginLeft: 7, opacity: active ? 0.85 : 0.7 }}>
                  {countByFilter(allCases, filter)}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          flex: '0 1 390px',
          minWidth: 260,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 11px',
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 10,
          background: TOKENS.surface,
        }}>
          <Icon d={I.search} size={16} stroke={TOKENS.textSubtle} strokeWidth={1.8} />
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Buscar contemplado, CPF, grupo ou cota..."
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 0,
              background: 'transparent',
              color: TOKENS.text,
              fontFamily: 'inherit',
              fontSize: 12.5,
            }}
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
          <thead>
            <tr style={{ background: TOKENS.surface }}>
              {['Caso', 'Contemplado', 'Produto', 'Grupo / Cota', 'Bancos', 'Status', 'Próxima ação', 'Atualização'].map((head) => (
                <th key={head} style={{
                  padding: '11px 14px',
                  textAlign: 'left',
                  fontSize: 10.5,
                  color: TOKENS.textSubtle,
                  textTransform: 'uppercase',
                  letterSpacing: 0.35,
                  fontWeight: 700,
                  borderBottom: `1px solid ${TOKENS.border}`,
                  whiteSpace: 'nowrap',
                }}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 34, textAlign: 'center', color: TOKENS.textMuted, fontSize: 13 }}>
                  {loading ? 'Carregando clientes da API...' : errorMessage ? (
                    <span>
                      {errorMessage}{' '}
                      <button type="button" onClick={onRetry} className="lz-link" style={{
                        border: 0, background: 'transparent', color: TOKENS.primary,
                        fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
                      }}>
                        Tentar novamente
                      </button>
                    </span>
                  ) : 'Nenhum caso encontrado para esse filtro.'}
                </td>
              </tr>
            ) : (
              cases.map((item) => (
                <CaseRow key={item.id} caseItem={item} onSelectCase={onSelectCase} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CaseRow({ caseItem, onSelectCase }) {
  const queueRule = getQueueBusinessRules(caseItem);
  const bankLabels = getLocalBankLabels(caseItem);
  const banks = getQueueBanksLabel(caseItem, queueRule, bankLabels);

  return (
    <tr
      className="lz-row-hover"
      onClick={() => onSelectCase(caseItem)}
      style={{ cursor: 'pointer', borderBottom: `1px solid ${TOKENS.border}` }}
    >
      <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
        <div className="num" style={{ fontSize: 12, fontWeight: 700, color: TOKENS.primary }}>{caseItem.externalCaseId}</div>
      </td>
      <td style={{ padding: '13px 14px', verticalAlign: 'top', minWidth: 190 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: TOKENS.primarySoft,
            color: TOKENS.primary,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11.5,
            fontWeight: 800,
            flexShrink: 0,
          }}>{getInitials(caseItem.name)}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, color: TOKENS.text, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {caseItem.name}
            </span>
            <span className="num" style={{ display: 'block', fontSize: 11.5, color: TOKENS.textSubtle, marginTop: 2 }}>
              {caseItem.cpfMasked || maskCpf(caseItem.cpf)}
            </span>
          </span>
        </div>
      </td>
      <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
        <span style={{ fontSize: 12.5, color: TOKENS.text }}>{PRODUCT_LABELS[caseItem.product] || caseItem.product}</span>
      </td>
      <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
        <div className="num" style={{ fontSize: 12.5, color: TOKENS.text }}>G {caseItem.group} / C {caseItem.quota}</div>
      </td>
      <td style={{ padding: '13px 14px', verticalAlign: 'top', maxWidth: 150 }}>
        <span style={{ fontSize: 12.5, color: bankLabels.length ? TOKENS.text : TOKENS.textSubtle }}>
          {banks}
        </span>
      </td>
      <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
        <Badge tone={queueRule.tone} dot>{queueRule.statusLabel}</Badge>
      </td>
      <td style={{ padding: '13px 14px', verticalAlign: 'top', maxWidth: 260 }}>
        <span style={{ display: 'block', fontSize: 12.2, color: TOKENS.textMuted, lineHeight: 1.4 }}>
          {queueRule.nextAction}
        </span>
      </td>
      <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
        <span style={{ fontSize: 12.2, color: TOKENS.textSubtle }}>{caseItem.updatedAtLabel || '-'}</span>
      </td>
    </tr>
  );
}

function OperationalFooter({ pendingCases, onSelectCase }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
      <Card padding="18px">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, color: TOKENS.title, fontSize: 15 }}>Pendências estruturadas</h3>
            <p style={{ margin: '4px 0 0', color: TOKENS.textMuted, fontSize: 12.5 }}>
              Motivos operacionais que impedem ou atrasam a geração do pacote 12m.
            </p>
          </div>
          <Icon d={I.alert} size={18} stroke={TOKENS.warning} strokeWidth={1.8} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {pendingCases.map((item) => {
            const meta = getStatusMeta(item.status);
            return (
              <button key={item.id} type="button" onClick={() => onSelectCase?.(item)} style={{
                padding: '12px 13px',
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 10,
                background: TOKENS.panel,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                  <span className="num" style={{ color: TOKENS.primary, fontWeight: 700, fontSize: 12 }}>
                    {item.externalCaseId}
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <div style={{ fontSize: 12.5, color: TOKENS.text, fontWeight: 650, marginBottom: 4 }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 12.2, color: TOKENS.textMuted, lineHeight: 1.4 }}>
                  {meta.pending}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card padding="18px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: TOKENS.successSoft,
            color: TOKENS.success,
          }}>
            <Icon d={I.doc} size={17} stroke="currentColor" strokeWidth={1.8} />
          </span>
          <div>
            <h3 style={{ margin: 0, color: TOKENS.title, fontSize: 15 }}>Outputs esperados</h3>
            <p style={{ margin: '3px 0 0', color: TOKENS.textMuted, fontSize: 12.5 }}>Entrega da POC para cada caso pronto.</p>
          </div>
        </div>
        {['Excel consolidado', 'Extrato financeiro bruto 12m', 'Evidência/hash da coleta', 'Status e pendências estruturadas'].map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderTop: `1px solid ${TOKENS.border}` }}>
            <Icon d={I.check} size={15} stroke={TOKENS.success} strokeWidth={2} />
            <span style={{ fontSize: 12.7, color: TOKENS.text }}>{item}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
