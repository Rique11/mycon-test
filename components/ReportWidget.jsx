// Widget global de reports: botão flutuante no canto inferior direito, presente
// em todas as telas, que abre um pop-up com select de categoria (relatar bug,
// nova funcionalidade, agendar reunião com técnicos ou outros), caixa de texto
// e anexo de até 5 arquivos. O envio registra o report na planilha Google
// Sheets do time via Apps Script Web App (URL em VITE_REPORT_SHEETS_URL),
// preenchendo as colunas Empresa (VITE_REPORT_EMPRESA), Banker (perfil do
// operador autenticado), Tipo, Relato, Data e Status inicial "Pendente"; os
// arquivos são enviados em base64 e salvos no Google Drive, com os links
// gravados na coluna Arquivos. Renderizado via portal no document.body.

import React from 'react';
import { createPortal } from 'react-dom';
import { TOKENS, RADII, SHADOWS, I } from '../tokens.js';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import { useBankerProfile } from '../hooks/useBankerProfile';

const MAX_FILES = 5;
const MAX_FILE_MB = 5;
const MAX_TOTAL_MB = 20;
const SEND_TIMEOUT_MS = 30000;

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
const SHEETS_URL = ENV.VITE_REPORT_SHEETS_URL ?? '';
const EMPRESA = ENV.VITE_REPORT_EMPRESA ?? '';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ReportWidget() {
  const bankerProfile = useBankerProfile();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [files, setFiles] = React.useState([]);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const fileInputRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const firstFieldRef = React.useRef(null);

  const bankerName = bankerProfile?.name || bankerProfile?.email || '';

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
      let totalBytes = next.reduce((sum, f) => sum + f.size, 0);
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
        if (totalBytes + file.size > MAX_TOTAL_MB * 1024 * 1024) {
          problems.push(`Total de anexos excede ${MAX_TOTAL_MB}MB.`);
          break;
        }
        totalBytes += file.size;
        next.push(file);
      }
      if (problems.length) setError(problems.join(' '));
      return next;
    });
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (sending) return;
    const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label;
    if (!categoryLabel) {
      setError('Selecione o tipo do report.');
      return;
    }
    if (!message.trim()) {
      setError('Descreva o report antes de enviar.');
      return;
    }
    if (!SHEETS_URL) {
      setError('Planilha não configurada. Defina VITE_REPORT_SHEETS_URL no .env e refaça o build.');
      return;
    }
    setError('');
    setSending(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const arquivos = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type,
          base64: await readFileAsBase64(file),
        })),
      );
      const res = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          empresa: EMPRESA,
          banker: bankerName,
          tipo: categoryLabel,
          relato: message.trim(),
          pagina: window.location.href,
          arquivos,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Planilha respondeu ${res.status}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'Falha ao registrar o report.');
      setNotice('Report registrado na planilha do time com status "Pendente". Obrigado!');
      resetForm();
    } catch {
      setError('Não foi possível registrar o report. Verifique a conexão e tente novamente.');
    } finally {
      clearTimeout(timer);
      setSending(false);
    }
  }

  const identity = [bankerName, EMPRESA].filter(Boolean).join(' · ');

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
                Relato
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
                disabled={sending || files.length >= MAX_FILES}
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

              <Button type="submit" disabled={sending} style={{ width: '100%' }}>
                <Icon d={I.send} size={14} />
                {sending ? 'Registrando…' : 'Registrar report'}
              </Button>

              <p style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.45, color: TOKENS.textSubtle }}>
                {identity ? `Enviando como ${identity}. ` : ''}
                O report entra na planilha do time com status "Pendente"; os arquivos anexados são salvos no
                Google Drive e linkados na planilha.
              </p>
            </form>
          </div>
        </>
      )}
    </>
  );

  return createPortal(widget, document.body);
}
