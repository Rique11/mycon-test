import { TOKENS, I } from '../tokens.js';
import Icon from './Icon.jsx';
import logoLizard from '../assets/logo-lizard.png';

const NAV_ITEMS = [
  { label: 'Painel',           icon: I.home },
  { label: 'Contemplação',     icon: I.list },
  { label: 'Clientes',         icon: I.users,    active: true },
  { label: 'Motor de crédito', icon: I.cpu },
  { label: 'Relatórios',       icon: I.fileText },
  { label: 'Configurações',    icon: I.settings },
];

export default function Sidebar({ onLogout }) {
  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: TOKENS.surface,
      borderRight: `1px solid ${TOKENS.border}`,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <img
            src={logoLizard}
            alt="Lizard"
            style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.text, letterSpacing: -0.3 }}>
              mycon
            </div>
            <div style={{ fontSize: 10.5, color: TOKENS.textMuted }}>Analytics</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <button key={item.label} className={`lz-nav-item${item.active ? ' active' : ''}`}>
            <Icon
              d={item.icon}
              size={15}
              stroke={item.active ? TOKENS.primary : TOKENS.textMuted}
              strokeWidth={item.active ? 2 : 1.7}
            />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${TOKENS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: TOKENS.primarySoft,
            color: TOKENS.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            OU
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Operador Mycon
            </div>
            <div style={{ fontSize: 11, color: TOKENS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              operador@Mycon.com.br
            </div>
          </div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="lz-btn-ghost"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: TOKENS.textMuted,
              textAlign: 'left',
            }}
          >
            Sair
          </button>
        )}
      </div>
    </div>
  );
}
