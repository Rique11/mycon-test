import React from 'react';
import { TOKENS, I } from '../tokens.js';
import Icon from '../components/Icon.jsx';
import Badge from '../components/Badge.jsx';
import { authApi, setTokens, ApiError } from '../services/api.js';

export default function LoginScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      window.location.href = '/';
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao fazer login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: TOKENS.bg,
        padding: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          width: '100%',
          maxWidth: 360,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: TOKENS.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={I.wallet} size={28} stroke="#fff" strokeWidth={1.5} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: TOKENS.text, margin: 0 }}>
              mycon
            </h1>
            <p style={{ fontSize: 13, color: TOKENS.textMuted, margin: 0 }}>
              Análise financeira para consultores
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <Badge tone="danger" label={error} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: TOKENS.text,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              disabled={loading}
              style={{
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: TOKENS.text,
              }}
            >
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              style={{
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

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 500,
              background: TOKENS.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !email || !password ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p
          style={{
            fontSize: 12,
            color: TOKENS.textMuted,
            textAlign: 'center',
            margin: 0,
          }}
        >
          Use suas credenciais do painel administrativo
        </p>
      </div>
    </div>
  );
}
