// Barra lateral de navegação da identidade Lizard Intelligence em tema azul:
// fundo navy da marca com conteúdo claro, seletor de workspace, itens de menu,
// selo de ambiente PoC, identificação do operador e ação de logout.

import React from 'react';
import { TOKENS, I, SHADOWS } from '../tokens.js';
import Icon from './Icon.jsx';
import logoLizard from '../assets/logo-app-icon.png';

const NAV_ITEMS = [
  { label: 'Painel', icon: I.grid, enabled: false },
  { label: 'POC Contemplados', icon: I.box, enabled: true },
  { label: 'Clientes', icon: I.users, enabled: true },
  { label: 'Relatórios', icon: I.bars, enabled: false },
  { label: 'Configurações', icon: I.settings, enabled: false },
];

const SIDEBAR_COLLAPSED_KEY = 'lizard_sidebar_collapsed';

export default function Sidebar({ activeItem = 'Clientes', onNavigate, onLogout }) {
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      }
      return next;
    });
  }

  return (
    <aside className="lz-sidebar--dark" style={{
      width: collapsed ? 76 : 248,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: TOKENS.brand,
      borderRight: '1px solid rgba(255,255,255,.10)',
      transition: 'width .16s ease',
    }}>
      <div style={{
        padding: collapsed ? '16px 10px 12px' : '20px 14px 14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, overflow: 'hidden', flexShrink: 0, boxShadow: SHADOWS.brand }}>
            <img
              src={logoLizard}
              alt="Lizard"
              style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', transform: 'scale(1.3)' }}
            />
          </div>
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: '#FFFFFF' }}>Lizard</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase' }}>
                Intelligence
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="lz-btn-ghost"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          aria-pressed={collapsed}
          style={{
            width: 30,
            height: 30,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <Icon d={collapsed ? I.chevRight : I.chevLeft} size={15} stroke="rgba(255,255,255,.82)" strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: collapsed ? '0 12px 14px' : '0 14px 14px' }}>
        <button style={{
          width: '100%',
          border: '1px solid rgba(255,255,255,.14)',
          background: 'rgba(255,255,255,.08)',
          borderRadius: 10,
          padding: collapsed ? '9px 0' : '9px 11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }} title="Mycon Crédito - Ambiente PoC">
          <span style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: 7,
            background: '#FFFFFF',
            color: TOKENS.brand,
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: 0.2,
          }}>MC</span>
          {!collapsed && (
            <>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Mycon Crédito
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 500 }}>Ambiente PoC</span>
              </span>
              <Icon d={I.chevDown} size={15} stroke="rgba(255,255,255,.6)" strokeWidth={2} />
            </>
          )}
        </button>
      </div>

      <nav style={{ flex: 1, padding: collapsed ? '4px 10px' : '4px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.label === activeItem;
          const enabled = item.enabled === true;
          return (
            <button
              key={item.label}
              className={`lz-nav-item${active ? ' active' : ''}`}
              disabled={!enabled}
              title={enabled ? item.label : `${item.label} - Em breve`}
              onClick={() => enabled && onNavigate?.(item.label)}
              style={{
                ...(collapsed ? { justifyContent: 'center', gap: 0, padding: '10px 0' } : {}),
                ...(!enabled ? { cursor: 'not-allowed', opacity: 0.42 } : {}),
              }}
            >
              <Icon d={item.icon} size={18} stroke="currentColor" strokeWidth={active ? 1.85 : 1.75} />
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: collapsed ? 10 : 14 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 8,
          padding: collapsed ? '9px 0' : '9px 11px',
          borderRadius: 9,
          background: 'rgba(251,191,36,.14)',
          border: '1px solid rgba(251,191,36,.30)',
          marginBottom: 12,
        }} title="Ambiente de testes - POC">
          <Icon d={I.flask} size={15} stroke="#FCD34D" strokeWidth={1.75} />
          {!collapsed && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#FCD34D' }}>
              Ambiente de testes · POC
            </span>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
          padding: collapsed ? '8px 0' : '8px 4px',
          marginBottom: onLogout ? 10 : 0,
        }} title="Operador Mycon">
          <span style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: '50%',
            background: '#FFFFFF',
            color: TOKENS.brand,
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>OM</span>
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>Operador Mycon</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                operador@mycon.com.br
              </span>
            </div>
          )}
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="lz-btn-ghost"
            title="Sair"
            style={{
              width: '100%',
              padding: collapsed ? '8px 0' : '8px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,.72)',
              textAlign: collapsed ? 'center' : 'left',
            }}
          >
            Sair
          </button>
        )}
      </div>
    </aside>
  );
}
