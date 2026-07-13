/**
 * NewCaseModal.jsx — modal de cadastro de novo contemplado da POC: formulário
 * com validação, criação/localização do cliente na API, geração do link de
 * consentimento Open Finance e tela de envio do link (copiar, WhatsApp, e-mail).
 */

import React from 'react';
import { TOKENS, I, SHADOWS } from '../../tokens.js';
import Icon from '../Icon.jsx';
import Button from '../Button.jsx';
import { ApiError, clientsApi } from '../../services/api';
import { onlyDigits } from '../../lib/format';
import { createPocCaseFromForm } from '../../hooks/usePocCases.js';
import { createOrFindClient, getClientId } from '../../services/clientResolution.js';

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

export default function NewCaseModal({ defaultCaseId, existingCases = [], onClose, onCreated }) {
  const [form, setForm] = React.useState(() => ({
    ...EMPTY_FORM,
    externalCaseId: defaultCaseId,
  }));
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [createdCase, setCreatedCase] = React.useState(null);
  const [copyLabel, setCopyLabel] = React.useState('Copiar');
  const copyTimerRef = React.useRef(null);

  React.useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

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
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopyLabel('Copiar'), 1800);
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
            <h2 style={{ margin: 0 }}>
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
                <input className="input" value={form.letterValue} onChange={(event) => updateField('letterValue', event.target.value)} />
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
