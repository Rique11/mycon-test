// Tela de lista de clientes: busca e grade de cartões de clientes a partir do hook
// useClientList. Reestilizada na identidade Lizard; comportamento preservado.

import React from 'react';
import { TOKENS, I } from '../tokens.js';
import Icon from '../components/Icon.jsx';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { useClientList } from '../hooks/useClientList';

export default function ClientListScreen({ onSelectClient, onLogout, activeItem = 'Clientes', onNavigate }) {
  const { clients, loading, error, retry } = useClientList();
  const [searchTerm, setSearchTerm] = React.useState('');

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf.includes(searchTerm)
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg }}>
        <Sidebar activeItem={activeItem} onNavigate={onNavigate} onLogout={onLogout} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: TOKENS.text, marginBottom: 8 }}>
              Carregando clientes...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg }}>
        <Sidebar activeItem={activeItem} onNavigate={onNavigate} onLogout={onLogout} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: TOKENS.danger, marginBottom: 12 }}>
              Erro ao carregar clientes
            </div>
            <p style={{ fontSize: 14, color: TOKENS.text, marginBottom: 20 }}>
              {error.message}
            </p>
            <button onClick={retry} className="lz-btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg }}>
      <Sidebar activeItem={activeItem} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderBottom: `1px solid ${TOKENS.border}`,
          background: TOKENS.surface,
        }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.4, color: TOKENS.title, margin: 0 }}>
            Meus Clientes
          </h1>
          <span style={{ fontSize: 13, color: TOKENS.textMuted }}>
            Total: {clients.length}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: 1200 }}>
            {/* Search */}
            <div style={{ marginBottom: 24 }}>
              <input
                type="text"
                placeholder="Buscar por nome, email ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: 400,
                  padding: '10px 12px',
                  fontSize: 14,
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: 8,
                  background: TOKENS.surface,
                  color: TOKENS.text,
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Clients Grid */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: 16, color: TOKENS.textMuted }}>
                  {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente disponível'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filtered.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => onSelectClient(client.id)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                    }}
                  >
                    <Card style={{
                      padding: '16px',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      ':hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = `0 4px 12px ${TOKENS.primary}20`;
                      e.currentTarget.style.borderColor = TOKENS.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = TOKENS.border;
                    }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: TOKENS.brand,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: 14,
                          flexShrink: 0,
                        }}>
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 2 }}>
                            {client.name}
                          </div>
                          <div style={{ fontSize: 12, color: TOKENS.textMuted, marginBottom: 4 }}>
                            {client.email}
                          </div>
                          <div style={{ fontSize: 11, color: TOKENS.textSubtle }}>
                            CPF: {client.cpf}
                          </div>
                        </div>
                      </div>
                      {client.active && (
                        <Badge tone="success" size="sm" dot style={{ marginTop: 8 }}>
                          Ativo
                        </Badge>
                      )}
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
