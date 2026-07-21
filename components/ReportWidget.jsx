// Widget global de reports: botão flutuante no canto inferior direito, presente
// em todas as telas, que abre um pop-up com select de categoria (relatar bug,
// nova funcionalidade, agendar reunião com técnicos ou outros), caixa de texto
// e anexo de até 5 arquivos. O envio abre o WhatsApp do time técnico (wa.me,
// número em VITE_REPORT_WHATSAPP) com o report formatado para o usuário
// confirmar; os arquivos não são transmitidos automaticamente — os nomes são
// incluídos na mensagem e os anexos podem ser adicionados manualmente na
// conversa. Renderizado via portal direto no document.body.

import React from 'react';
import { createPortal } from 'react-dom';
import { TOKENS, RADII, SHADOWS, I } from '../tokens.js';
import Icon from './Icon.jsx';
import Button from './Button.jsx';

const MAX_FILES = 5;
const MAX_FILE_MB = 10;

const CATEGORIES = [
  { value: 'bug', label: 'Relatar bug' },
  { value: 'feature', label: 'Nova funcionalidade' },
  { value: 'meeting', label: 'Agendar reunião com técnicos' },
  { value: 'other', label: 'Outros' },
];

const LOCAL_ICONS = {
  chat: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
  clip: 'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48',
};

const ENV = import.meta.env ?? {};
const WHATSAPP = String(ENV.VITE_REPORT_WHATSAPP ?? '').replace(/\D/g, '');

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSummary(categoryLabel, message, files) {
  return [
    `Report — ${categoryLabel}`,
    '',
    message,
    '',
    files.length
      ? `Arquivos (${files.length}): ${files.map((f) => `${f.name} (${formatBytes(f.size)})`).join(', ')}`
      : 'Sem arquivos anexados.',
    `Página: ${window.location.href}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
  ].join('\n');
}

export default function ReportWidget() {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [files, setFiles] = React.useState([]);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const fileInputRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const firstFieldRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    firstFieldRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  function resetForm() {
    setCategory('');
    setMessage('');
    setFiles([]);
  }

  function openPopup() {
    setError('');
    setNotice('');
    setOpen(true);
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList ?? []);
    if (!incoming.length) return;
    setError('');
    setFiles((current) => {
      const next = [...current];
      const problems = [];
      for (const file of incoming) {
        const duplicate = next.some(
          (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
        );
        if (duplicate) continue;
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          problems.push(`"${file.name}" excede ${MAX_FILE_MB}MB.`);
          continue;
        }
        if (next.length >= MAX_FILES) {
          problems.push(`Limite de ${MAX_FILES} arquivos atingido.`);
          break;
        }
        next.push(file);
      }
      if (problems.length) setError(problems.join(' '));
      return next;
    });
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label;
    if (!categoryLabel) {
      setError('Selecione o tipo do report.');
      return;
    }
    if (!message.trim()) {
      setError('Descreva o report antes de enviar.');
      return;
    }
    if (!WHATSAPP) {
      setError('WhatsApp do time não configurado. Defina VITE_REPORT_WHATSAPP no .env.local.');
      return;
    }
    setError('');
    const summary = buildSummary(categoryLabel, message.trim(), files);
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(summary)}`, '_blank', 'noopener,noreferrer');
    setNotice(
      files.length
        ? 'Report aberto no WhatsApp — confirme o envio por lá e anexe os arquivos na conversa.'
        : 'Report aberto no WhatsApp — confirme o envio por lá.',
    );
    resetForm();
  }

  const widget = (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Abrir reports"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? setOpen(false) : openPopup())}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: RADII.pill,
          border: 'none',
          background: TOKENS.primary,
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(36,84,217,.35)',
          zIndex: 9990,
        }}
      >
        <Icon d={LOCAL_ICONS.chat} size={22} strokeWidth={2} />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(16,26,51,.32)', zIndex: 9998 }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Enviar report"
            className="lz-anim-fade"
            style={{
              position: 'fixed',
              bottom: 92,
              right: 24,
              width: 380,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
              background: TOKENS.surface,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: RADII.modal,
              boxShadow: SHADOWS.modal,
              padding: 20,
              zIndex: 9999,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon d={LOCAL_ICONS.chat} size={17} strokeWidth={2} stroke={TOKENS.primary} />
                Reports
              </h3>
              <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => setOpen(false)}>
                <Icon d={I.x} size={16} />
              </Button>
            </div>

            {notice && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  marginBottom: 12,
                  fontSize: 13,
                  borderRadius: RADII.control,
                  background: TOKENS.successSoft,
                  color: TOKENS.success,
                }}
              >
                <Icon d={I.check} size={15} strokeWidth={2} />
                {notice}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label
                htmlFor="report-category"
                style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: TOKENS.textMuted, marginBottom: 6 }}
              >
                Tipo
              </label>
              <select
                id="report-category"
                ref={firstFieldRef}
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ marginBottom: 12 }}
              >
                <option value="" disabled>
                  Selecione o tipo do report
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <label
                htmlFor="report-message"
                style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: TOKENS.textMuted, marginBottom: 6 }}
              >
                Descrição
              </label>
              <textarea
                id="report-message"
                className="input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva o problema, a ideia ou o assunto da reunião…"
                rows={4}
                style={{ resize: 'vertical', minHeight: 96, marginBottom: 12 }}
              />

              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= MAX_FILES}
                style={{ marginBottom: files.length ? 8 : 12 }}
              >
                <Icon d={LOCAL_ICONS.clip} size={14} />
                Anexar arquivos ({files.length}/{MAX_FILES})
              </Button>

              {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        fontSize: 12.5,
                        background: TOKENS.panel,
                        border: `1px solid ${TOKENS.border}`,
                        borderRadius: RADII.control,
                      }}
                    >
                      <Icon d={I.doc} size={14} stroke={TOKENS.textMuted} />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: TOKENS.text,
                        }}
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      <span style={{ color: TOKENS.textSubtle, flexShrink: 0 }} className="num">
                        {formatBytes(file.size)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remover ${file.name}`}
                        onClick={() => removeFile(index)}
                        style={{
                          display: 'flex',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: TOKENS.textMuted,
                          padding: 2,
                        }}
                      >
                        <Icon d={I.x} size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 12px',
                    marginBottom: 12,
                    fontSize: 12.5,
                    borderRadius: RADII.control,
                    background: TOKENS.dangerSoft,
                    color: TOKENS.danger,
                  }}
                >
                  <Icon d={I.alert} size={15} strokeWidth={2} />
                  {error}
                </div>
              )}

              <Button type="submit" style={{ width: '100%' }}>
                <Icon d={I.send} size={14} />
                Enviar via WhatsApp
              </Button>

              <p style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.45, color: TOKENS.textSubtle }}>
                O report abre no WhatsApp do time técnico com a mensagem formatada — confirme o envio por lá.
                Os arquivos não são enviados automaticamente: os nomes vão na mensagem e os anexos podem ser
                adicionados manualmente na conversa.
              </p>
            </form>
          </div>
        </>
      )}
    </>
  );

  return createPortal(widget, document.body);
}
