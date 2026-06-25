// Sidebar (248px) da identidade Lizard Intelligence: marca, seletor de workspace,
// navegação (item ativo com barra lateral), rodapé com selo de ambiente e usuário.

import { TOKENS, I, SHADOWS } from '../tokens.js';
import Icon from './Icon.jsx';
import logoLizard from '../assets/logo-app-icon.png';

const NAV_ITEMS = [
  { label: 'Painel',           icon: I.grid },
  { label: 'POC Contemplados', icon: I.box },
  { label: 'Clientes',         icon: I.users,    active: true },
  { label: 'Relatórios',       icon: I.bars },
  { label: 'Configurações',    icon: I.settings },
];

export default function Sidebar({ onLogout }) {
  return (
    <aside style={{
      width: 248,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: TOKENS.surface,
      borderRight: `1px solid ${TOKENS.border}`,
    }}>
      {/* Marca */}
      <div style={{ padding: '20px 18px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <img
          src={logoLizard}
          alt="Lizard"
          style={{ width: 34, height: 34, borderRadius: 9, display: 'block', objectFit: 'cover', boxShadow: SHADOWS.brand }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: TOKENS.title }}>Lizard</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8, color: TOKENS.textSubtle, textTransform: 'uppercase' }}>
            Intelligence
          </span>
        </div>
      </div>

      {/* Seletor de workspace */}
      <div style={{ padding: '0 14px 14px' }}>
        <button style={{
          width: '100%', border: `1px solid ${TOKENS.border}`, background: TOKENS.panel,
          borderRadius: 10, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}>
          <span style={{
            width: 28, height: 28, flexShrink: 0, borderRadius: 7, background: TOKENS.brand,
            color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex',
            alignItems: 'center', justifyContent: 'center', letterSpacing: 0.2,
          }}>MC</span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Mycon Crédito
            </span>
            <span style={{ fontSize: 11, color: TOKENS.textSubtle, fontWeight: 500 }}>Ambiente PoC</span>
          </span>
          <Icon d={I.chevDown} size={15} stroke={TOKENS.textSubtle} strokeWidth={2} />
        </button>
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <button key={item.label} className={`lz-nav-item${item.active ? ' active' : ''}`}>
            <Icon d={item.icon} size={18} stroke="currentColor" strokeWidth={item.active ? 1.85 : 1.75} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Rodapé */}
      <div style={{ padding: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px',
          borderRadius: 9, background: TOKENS.warningSoft, border: `1px solid ${TOKENS.warningBorder}`,
          marginBottom: 12,
        }}>
          <Icon d={I.flask} size={15} stroke={TOKENS.warning} strokeWidth={1.75} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: TOKENS.warningStrong }}>
            Ambiente de testes · POC
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', marginBottom: onLogout ? 10 : 0 }}>
          <span style={{
            width: 32, height: 32, flexShrink: 0, borderRadius: '50%', background: TOKENS.brand,
            color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>OM</span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>Operador Mycon</span>
            <span style={{ fontSize: 11, color: TOKENS.textSubtle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              operador@mycon.com.br
            </span>
          </div>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="lz-btn-ghost"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: TOKENS.textMuted, textAlign: 'left' }}
          >
            Sair
          </button>
        )}
      </div>
    </aside>
  );
}
