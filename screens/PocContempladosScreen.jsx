import React from 'react';
import { TOKENS, I, SHADOWS } from '../tokens.js';
import Sidebar from '../components/Sidebar.jsx';
import Icon from '../components/Icon.jsx';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import StepNumber from '../components/StepNumber.jsx';
import { ApiError, clientsApi } from '../services/api';
import { exportConsolidado, exportExtratoPdf } from '../services/exportExcel.js';
import {
  PRODUCT_LABELS,
  POC_FILTERS,
  getQueueBusinessRules,
  getStatusMeta,
} from '../services/domain';
import { maskCpf, onlyDigits } from '../lib/format';
import { createPocCaseFromForm, usePocCases } from '../hooks/usePocCases.js';

const EMPTY_FORM = {
  externalCaseId: '',
  name: '',
  cpf: '',
  phone: '',
  email: '',
  group: '',
  quota: '',
  product: 'imovel',
  letterValue: '',
  contemplationDate: '',
  notes: '',
};

const FIELD_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

function getArrayFromPage(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}

function getClientId(client) {
  return client?.id ?? client?.clientId ?? client?.uuid ?? null;
}

function isSameCpf(client, cpf) {
  return onlyDigits(client?.cpf) === onlyDigits(cpf);
}

function isSameEmail(client, email) {
  return email && String(client?.email || '').toLowerCase() === String(email).toLowerCase();
}

function isSameName(client, name) {
  return name && String(client?.name || '').trim().toLowerCase() === String(name).trim().toLowerCase();
}

function findMatchingClient(clients, caseItem) {
  const cpf = onlyDigits(caseItem?.cpf);
  return clients.find((client) => cpf && isSameCpf(client, cpf))
    || clients.find((client) => isSameEmail(client, caseItem?.email))
    || clients.find((client) => isSameName(client, caseItem?.name));
}

function getClientResolution(clients, caseItem) {
  const byCpf = clients.filter((client) => onlyDigits(caseItem?.cpf) && isSameCpf(client, caseItem?.cpf));
  if (byCpf.length === 1) return { client: byCpf[0] };
  if (byCpf.length > 1) return { ambiguous: true, reason: 'CPF' };

  const byEmail = clients.filter((client) => isSameEmail(client, caseItem?.email));
  if (byEmail.length === 1) return { client: byEmail[0] };
  if (byEmail.length > 1) return { ambiguous: true, reason: 'e-mail' };

  const byName = clients.filter((client) => isSameName(client, caseItem?.name));
  if (byName.length === 1) return { client: byName[0] };
  if (byName.length > 1) return { ambiguous: true, reason: 'nome' };

  return { client: null };
}

async function resolveClientForCase(caseItem) {
  if (caseItem.clientId) {
    const client = await clientsApi.getById(caseItem.clientId);
    return { client, id: getClientId(client) || caseItem.clientId };
  }

  const cpf = onlyDigits(caseItem.cpf);
  const focusedResponse = await clientsApi.list({ q: cpf || caseItem.email || caseItem.name, page: 0, size: 20 });
  const focusedClients = getArrayFromPage(focusedResponse);
  let resolution = getClientResolution(focusedClients, caseItem);

  if (!resolution.client && !resolution.ambiguous) {
    const allResponse = await clientsApi.list({ page: 0, size: 100 });
    resolution = getClientResolution(getArrayFromPage(allResponse), caseItem);
  }

  if (resolution.ambiguous) {
    const error = new Error(`Mais de um cliente encontrado pelo mesmo ${resolution.reason}.`);
    error.code = 'ambiguous';
    throw error;
  }

  const id = getClientId(resolution.client);
  if (!id) {
    const error = new Error('Cliente não encontrado na aba Clientes.');
    error.code = 'not_found';
    throw error;
  }

  return { client: resolution.client, id };
}

async function createOrFindClient(form) {
  const cpf = onlyDigits(form.cpf);
  const search = await clientsApi.list({ q: cpf, page: 0, size: 20 });
  const existing = getArrayFromPage(search).find((client) => isSameCpf(client, cpf));

  if (existing) return existing;

  return clientsApi.create({
    name: form.name.trim(),
    email: form.email.trim(),
    cpf,
  });
}

function countByFilter(cases, filter) {
  if (!filter.statuses) return cases.length;
  return cases.filter((item) => filter.statuses.includes(item.status)).length;
}

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

function fallbackEvidenceHash(caseItem) {
  return `POC-${String(caseItem.externalCaseId || caseItem.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}-MOCK`;
}

function getCaseEvents(caseItem) {
  if (Array.isArray(caseItem.events) && caseItem.events.length) return caseItem.events;

  const meta = getStatusMeta(caseItem.status);
  return [
    { at: caseItem.createdAt, label: 'Caso carregado a partir do mock da POC', actor: 'Lizard' },
    { at: caseItem.createdAt, label: meta.label, actor: meta.owner || 'Operação' },
  ];
}

export default function PocContempladosScreen({ onLogout, onNavigate, onSelectClient }) {
  const { cases, addCase, updateCase, nextCaseId } = usePocCases();
  const [activeFilter, setActiveFilter] = React.useState('todos');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showNewCase, setShowNewCase] = React.useState(false);
  const [selectedCase, setSelectedCase] = React.useState(null);

  const filteredCases = React.useMemo(
    () => getFilteredCases(cases, activeFilter, searchTerm),
    [cases, activeFilter, searchTerm],
  );

  const metrics = React.useMemo(() => {
    const ready = cases.filter((item) => item.status === 'pronto').length;
    const connected = cases.filter((item) => item.status === 'conectado').length;
    const pending = countByFilter(cases, POC_FILTERS.find((item) => item.key === 'pendencia'));
    const waiting = countByFilter(cases, POC_FILTERS.find((item) => item.key === 'aguardando'));

    return [
      { label: 'Casos na fila', value: cases.length, note: 'Base local da POC', tone: 'blue' },
      { label: 'Aguardando cliente', value: waiting, note: 'Consentimento enviado ou pendente', tone: 'warning' },
      { label: 'Open Finance conectado', value: connected, note: 'Coleta em andamento', tone: 'purple' },
      { label: 'Extratos prontos', value: ready, note: 'Pacote 12m gerado', tone: 'success' },
      { label: 'Pendências', value: pending, note: 'Casos que pedem ação', tone: 'danger' },
    ];
  }, [cases]);

  const pendingCases = React.useMemo(() => getPendingCases(cases), [cases]);

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
                allCases={cases}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onSelectCase={setSelectedCase}
              />

              <OperationalFooter pendingCases={pendingCases} onSelectCase={setSelectedCase} />
            </div>
          </section>
        </div>
      </main>

      {showNewCase && (
        <NewCaseModal
          defaultCaseId={nextCaseId}
          existingCases={cases}
          onClose={() => setShowNewCase(false)}
          onCreated={(newCase) => {
            addCase(newCase);
            setSelectedCase(newCase);
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

function CasesTable({ cases, allCases, activeFilter, onFilterChange, searchTerm, onSearchTermChange, onSelectCase }) {
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
          <span style={{
            flexShrink: 0,
            fontSize: 10.5,
            color: TOKENS.textSubtle,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 6,
            padding: '2px 6px',
            background: TOKENS.panel,
          }}>Ctrl K</span>
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
                  Nenhum caso encontrado para esse filtro.
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

function NewCaseModal({ defaultCaseId, existingCases = [], onClose, onCreated }) {
  const [form, setForm] = React.useState(() => ({
    ...EMPTY_FORM,
    externalCaseId: defaultCaseId,
    letterValue: 'R$ 420.000,00',
  }));
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [createdCase, setCreatedCase] = React.useState(null);
  const [copyLabel, setCopyLabel] = React.useState('Copiar');

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    const required = [
      ['externalCaseId', 'Informe o numero do caso.'],
      ['name', 'Informe o nome do contemplado.'],
      ['cpf', 'Informe o CPF.'],
      ['phone', 'Informe o celular/WhatsApp.'],
      ['email', 'Informe o e-mail.'],
      ['group', 'Informe o grupo.'],
      ['quota', 'Informe a cota.'],
      ['letterValue', 'Informe o valor da carta.'],
      ['contemplationDate', 'Informe a data da contemplação.'],
    ];

    const missing = required.find(([field]) => !String(form[field] || '').trim());
    if (missing) return missing[1];
    if (onlyDigits(form.cpf).length !== 11) return 'CPF deve ter 11 dígitos.';
    const externalId = form.externalCaseId.trim().toLowerCase();
    const duplicate = existingCases.some((item) => String(item.externalCaseId || '').trim().toLowerCase() === externalId);
    if (duplicate) return 'Já existe um caso com esse ID externo na fila.';
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const client = await createOrFindClient(form);
      const clientId = getClientId(client);

      if (!clientId) {
        throw new ApiError(500, 'Cliente criado/localizado sem identificador retornado pela API.', client);
      }

      const consentResponse = await clientsApi.getConsentLink(clientId);
      const consentLink = consentResponse?.url || consentResponse?.link || '';

      if (!consentLink) {
        throw new ApiError(502, 'A API criou/localizou o cliente, mas não retornou uma URL de consentimento.', consentResponse);
      }

      const newCase = createPocCaseFromForm(form, {
        clientId,
        consentLink,
        consent: consentResponse?.consent || null,
      });

      onCreated(newCase);
      setCreatedCase(newCase);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível criar o caso agora. Tente novamente.');
      }
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!createdCase?.consentLink) return;
    try {
      await navigator.clipboard.writeText(createdCase.consentLink);
      setCopyLabel('Copiado');
      window.setTimeout(() => setCopyLabel('Copiar'), 1800);
    } catch {
      setCopyLabel('Falhou');
    }
  }

  function openWhatsApp() {
    if (!createdCase?.consentLink) return;
    const message = `Olá, ${createdCase.name}. Para seguirmos com sua contemplação Mycon, acesse o link de consentimento Open Finance: ${createdCase.consentLink}`;
    window.open(`https://wa.me/55${createdCase.phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  function openEmail() {
    if (!createdCase?.consentLink) return;
    const subject = 'Consentimento Open Finance - Mycon';
    const body = `Olá, ${createdCase.name}.\n\nPara seguirmos com sua contemplação Mycon, acesse o link de consentimento Open Finance:\n${createdCase.consentLink}\n\nObrigado.`;
    window.location.href = `mailto:${createdCase.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="lz-anim-fade" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'rgba(16,26,51,.34)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div className="lz-anim-panel" style={{
        width: 'min(760px, 100%)',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        background: TOKENS.surface,
        borderRadius: 14,
        border: `1px solid ${TOKENS.border}`,
        boxShadow: SHADOWS.modal,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          padding: '20px 22px',
          borderBottom: `1px solid ${TOKENS.border}`,
        }}>
          <div>
            <h2 style={{ margin: 0, color: TOKENS.title, fontSize: 18 }}>
              {createdCase ? 'Link de consentimento gerado' : 'Novo contemplado'}
            </h2>
            <p style={{ margin: '5px 0 0', color: TOKENS.textMuted, fontSize: 12.8, lineHeight: 1.45 }}>
              {createdCase
                ? `${createdCase.externalCaseId} foi cadastrado na fila operacional.`
                : 'Cadastre os dados que a Lizard precisa para operar a POC e gerar o link Open Finance.'}
            </p>
          </div>
          <button className="lz-btn-ghost" onClick={onClose} style={{ width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={I.x} size={16} stroke={TOKENS.textMuted} strokeWidth={2} />
          </button>
        </div>

        {createdCase ? (
          <div style={{ padding: 22 }}>
            <div style={{
              padding: 15,
              border: `1px solid ${TOKENS.successSoft}`,
              borderRadius: 12,
              background: TOKENS.successSoft,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Icon d={I.check} size={18} stroke={TOKENS.success} strokeWidth={2.1} />
                <span style={{ color: TOKENS.success, fontWeight: 750, fontSize: 14 }}>Consentimento pronto para envio</span>
              </div>
              <div style={{
                padding: '10px 12px',
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 9,
                background: TOKENS.surface,
                color: TOKENS.text,
                fontSize: 12.5,
                wordBreak: 'break-all',
                lineHeight: 1.45,
              }}>
                {createdCase.consentLink || 'Link retornado sem URL visível.'}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="outline" onClick={copyLink}>
                  <Icon d={I.link} size={15} stroke="currentColor" strokeWidth={1.9} />
                  {copyLabel}
                </Button>
                <Button variant="secondary" onClick={openWhatsApp}>
                  <Icon d={I.send} size={15} stroke="currentColor" strokeWidth={1.9} />
                  WhatsApp
                </Button>
                <Button variant="secondary" onClick={openEmail}>
                  <Icon d={I.doc} size={15} stroke="currentColor" strokeWidth={1.9} />
                  E-mail
                </Button>
              </div>
              <Button onClick={onClose}>Fechar e voltar a fila</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <Field label="ID externo / caso">
                <input className="input" value={form.externalCaseId} onChange={(event) => updateField('externalCaseId', event.target.value)} />
              </Field>
              <Field label="Nome completo">
                <input className="input" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Nome do contemplado" />
              </Field>
              <Field label="CPF">
                <input className="input" value={form.cpf} onChange={(event) => updateField('cpf', event.target.value)} placeholder="000.000.000-00" />
              </Field>
              <Field label="Celular / WhatsApp">
                <input className="input" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="(11) 99999-9999" />
              </Field>
              <Field label="E-mail">
                <input className="input" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="cliente@email.com" />
              </Field>
              <Field label="Produto">
                <select className="input" value={form.product} onChange={(event) => updateField('product', event.target.value)}>
                  <option value="imovel">Imóvel</option>
                  <option value="veiculo">Veículo</option>
                  <option value="servico">Serviço</option>
                </select>
              </Field>
              <Field label="Grupo">
                <input className="input" value={form.group} onChange={(event) => updateField('group', event.target.value)} />
              </Field>
              <Field label="Cota">
                <input className="input" value={form.quota} onChange={(event) => updateField('quota', event.target.value)} />
              </Field>
              <Field label="Valor da carta">
                <input className="input" value={form.letterValue} onChange={(event) => updateField('letterValue', event.target.value)} placeholder="R$ 420.000,00" />
              </Field>
              <Field label="Data da contemplação">
                <input className="input" type="date" value={form.contemplationDate} onChange={(event) => updateField('contemplationDate', event.target.value)} />
              </Field>
            </div>

            <Field label="Observações internas" style={{ marginTop: 14 }}>
              <textarea
                className="input"
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={3}
                placeholder="Contexto operacional, combinados com a Mycon ou observacoes para o time."
                style={{ resize: 'vertical', minHeight: 82 }}
              />
            </Field>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                marginTop: 14,
                padding: '10px 12px',
                borderRadius: 9,
                background: TOKENS.dangerSoft,
                color: TOKENS.danger,
                fontSize: 12.7,
                fontWeight: 600,
              }}>
                <Icon d={I.alert} size={15} stroke="currentColor" strokeWidth={1.9} />
                {error}
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              alignItems: 'center',
              marginTop: 20,
              paddingTop: 16,
              borderTop: `1px solid ${TOKENS.border}`,
            }}>
              <p style={{ margin: 0, color: TOKENS.textMuted, fontSize: 12.2, lineHeight: 1.45, maxWidth: 430 }}>
                O link gera um pedido de consentimento Open Finance. Nenhum dado é coletado até o cliente autorizar.
              </p>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={creating}>
                  <Icon d={I.link} size={15} stroke="currentColor" strokeWidth={1.9} />
                  {creating ? 'Gerando...' : 'Gerar link'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <label style={{ ...FIELD_STYLE, ...style }}>
      <span style={{ color: TOKENS.textMuted, fontSize: 11.5, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
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
      validity: caseItem.consentExpiresAt ? formatDate(caseItem.consentExpiresAt) : 'Prazo nao informado',
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

function getAccountTags(caseItem) {
  const banks = getLocalBankLabels(caseItem);
  return banks.map((bank, index) => {
    if (caseItem.status === 'semRenda') return { bank, label: 'Sem renda', tone: 'danger' };
    if (caseItem.status === 'maisContas') return { bank, label: index === 0 ? 'Conta de apoio' : 'Sem renda', tone: 'warning' };
    return { bank, label: index === 0 ? 'Recebe renda' : 'Conta de apoio', tone: index === 0 ? 'success' : 'neutral' };
  });
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
    || fallbackEvidenceHash(caseItem);
}

function getPeriodLabel(statement, income) {
  const from = statement?.fromYearMonth || income?.fromYearMonth;
  const to = statement?.toYearMonth || income?.toYearMonth;
  if (from && to) return `${from} a ${to}`;
  return '12 meses';
}

function normalizeBankLabel(value = '') {
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

function getLocalBankLabels(caseItem) {
  return Array.from(new Set((caseItem.banks || []).map(normalizeBankLabel).filter(Boolean)));
}

function haveSameBankLabels(current = [], next = []) {
  if (current.length !== next.length) return false;
  const currentSet = new Set(current);
  return next.every((label) => currentSet.has(label));
}

function getQueueBanksLabel(caseItem, queueRule, bankLabels = getLocalBankLabels(caseItem)) {
  if (bankLabels.length) return bankLabels.join(', ');
  return queueRule.accepted ? 'Banco nao identificado' : 'Aguardando consentimento';
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

function deriveInstitutions(caseItem, evidence) {
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
      [
        link?.bank,
        link?.bankName,
        link?.institution,
        link?.institutionName,
        link?.brandName,
        link?.provider,
      ].forEach((value) => {
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

function deriveAccountTags(caseItem, evidence) {
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
      [
        link?.bank,
        link?.bankName,
        link?.institution,
        link?.institutionName,
        link?.brandName,
        link?.provider,
      ].forEach((value) => {
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

function appendCaseEvent(caseItem, label, actor = 'Lizard') {
  return [
    ...(Array.isArray(caseItem.events) ? caseItem.events : getCaseEvents(caseItem)),
    { at: new Date().toISOString(), label, actor },
  ];
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

function CaseDrawer({ caseItem, onClose, onSelectClient, onUpdateCase }) {
  const baseMeta = getStatusMeta(caseItem.status);
  const events = getCaseEvents(caseItem);
  const consent = getConsentInfo(caseItem);
  const [openingClient, setOpeningClient] = React.useState(false);
  const [openClientError, setOpenClientError] = React.useState('');
  const [drawerMessage, setDrawerMessage] = React.useState('');
  const [copyLabel, setCopyLabel] = React.useState('Copiar');
  const [generatingLink, setGeneratingLink] = React.useState(false);
  const [exporting, setExporting] = React.useState('');
  const [evidenceState, setEvidenceState] = React.useState({
    loading: true,
    client: null,
    id: null,
    insights: null,
    income: null,
    statement: null,
    links: [],
    error: '',
  });

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
  const accountTags = deriveAccountTags(caseItem, evidence);
  const institutions = deriveInstitutions(caseItem, evidence);

  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
          onUpdateCase?.(caseItem.id, {
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

  function showMessage(message) {
    setDrawerMessage(message);
    window.setTimeout(() => setDrawerMessage(''), 2800);
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
      window.setTimeout(() => setCopyLabel('Copiar'), 1800);
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
      window.setTimeout(() => setCopyLabel('Copiar'), 1800);
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
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 7);
      onUpdateCase?.(caseItem.id, {
        status: 'enviado',
        consentLink,
        consent: result?.consent || caseItem.consent,
        consentCreatedAt: now.toISOString(),
        consentExpiresAt: expiresAt.toISOString(),
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
            </div>
          </DrawerSection>

          <DrawerSection number={2} title="Status do consentimento" background={TOKENS.panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <Badge tone={consent.tone} dot>{consent.label}</Badge>
              {caseItem.consentLink && (
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Icon d={I.link} size={14} stroke="currentColor" strokeWidth={1.9} />
                  {copyLabel}
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <InfoLine label="Validade do link" value={consent.validity} />
              <InfoLine label="ID do consentimento" value={consent.id} mono />
              <InfoLine label="Link" value={caseItem.consentLink ? 'Disponivel para copiar' : 'Nao armazenado nesta linha'} />
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
