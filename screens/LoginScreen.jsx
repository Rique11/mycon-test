// Tela de login da identidade Lizard Intelligence: marca, formulário de e-mail e
// senha e autenticação via authApi. Apenas apresentação reestilizada; lógica intacta.

import React from 'react';
import { TOKENS, SHADOWS } from '../tokens.js';
import Button from '../components/Button.jsx';
import logoLizard from '../assets/logo-app-icon.png';
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
        padding: 24,
      }}
    >
      <div
        className="lz-anim-fade"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          width: '100%',
          maxWidth: 380,
        }}
      >
        {/* Marca */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          <img
            src={logoLizard}
            alt="Lizard"
            style={{ width: 56, height: 56, borderRadius: 14, boxShadow: SHADOWS.brand, display: 'block', objectFit: 'cover' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3, color: TOKENS.title, margin: 0 }}>
              Lizard Intelligence
            </h1>
            <p style={{ fontSize: 13, color: TOKENS.textMuted, margin: 0 }}>
              Open Finance · Mycon Crédito
            </p>
          </div>
        </div>

        {/* Formulário */}
        <div className="card" style={{ padding: '24px 22px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 9, background: TOKENS.dangerSoft, color: TOKENS.danger, fontSize: 12.5, fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text }}>Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text }}>Senha</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              size="default"
              disabled={loading || !email || !password}
              style={{ width: '100%', marginTop: 2 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p style={{ fontSize: 12, color: TOKENS.textSubtle, textAlign: 'center', margin: 0 }}>
          Use suas credenciais do painel administrativo
        </p>
      </div>
    </div>
  );
}
