// Wrapper de tela assíncrona: renderiza estados de carregamento e erro com
// Sidebar consistente; quando não há pendência, renderiza o conteúdo (children).

import React from 'react';
import { TOKENS } from '../tokens.js';
import Sidebar from './Sidebar.jsx';

export default function AsyncScreen({
  loading,
  error,
  loadingMessage = 'Carregando...',
  loadingSub,
  errorTitle = 'Erro ao carregar dados',
  onRetry,
  secondaryLabel,
  onSecondary,
  sidebarProps,
  children,
}) {
  if (!loading && !error) return children;

  return (
    <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg }}>
      {sidebarProps && <Sidebar {...sidebarProps} />}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: TOKENS.text, marginBottom: 8 }}>
              {loadingMessage}
            </div>
            {loadingSub && (
              <div style={{ fontSize: 14, color: TOKENS.textMuted }}>{loadingSub}</div>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: TOKENS.danger, marginBottom: 12 }}>
              {errorTitle}
            </div>
            <p style={{ fontSize: 14, color: TOKENS.text, marginBottom: 20, lineHeight: 1.5 }}>
              {error?.message}
            </p>
            <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              {onRetry && (
                <button onClick={onRetry} className="lz-btn-primary" style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>
                  Tentar novamente
                </button>
              )}
              {onSecondary && (
                <button onClick={onSecondary} className="lz-btn-ghost" style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: TOKENS.text }}>
                  {secondaryLabel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
