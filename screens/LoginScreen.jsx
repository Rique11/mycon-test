// Tela de login da identidade Lizard Intelligence / Mycon: marca, capa deslizante
// sobre o card e formulário de e-mail e senha com autenticação via authApi.
// Estética "reveal" (capa + gradiente que surgem no hover/focus) sobre a IDV azul.

import React from 'react';
import './LoginScreen.css';
import logoLizard from '../assets/logo-app-icon.png';
import { authApi, setTokens, ApiError } from '../services/api';

export default function LoginScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const [revealed, setRevealed] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [forgotHint, setForgotHint] = React.useState(false);

  const active = revealed || focused;

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
    <div className={`login-page ${active ? 'login-page--revealed' : ''}`}>
      <div className="login-glow" />

      <div className="login-wrapper">
        <div className={`login-logo ${active ? 'login-logo--revealed' : ''}`}>
          <img src={logoLizard} alt="Lizard Intelligence" className="login-logo__mark" />
          <span className="login-logo__credit">
            <span className="login-logo__credit-by">made by </span>
            <span className="login-logo__credit-name">Lizard</span>
          </span>
        </div>

        <div
          className="login-card"
          onMouseEnter={() => setRevealed(true)}
          onMouseLeave={() => setRevealed(false)}
        >
          <div className={`login-cover ${focused ? 'login-cover--hidden' : ''}`}>
            <div className="login-cover__mark">
              <img src={logoLizard} alt="Lizard Intelligence" />
            </div>
            <span className="login-cover__name">Lizard Intelligence</span>
            <span className="login-cover__hint">Passe o mouse ou clique para entrar</span>
          </div>

          <h2 className="login-card__title">Bem-vindo de volta</h2>
          <p className="login-card__subtitle">
            Entre com suas credenciais para continuar
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-form__field">
              <label className="login-form__label">E-mail</label>
              <input
                className="login-form__input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="seu@email.com"
                disabled={loading}
              />
            </div>

            <div className="login-form__field">
              <label className="login-form__label">Senha</label>
              <input
                className="login-form__input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <div className="login-form__forgot">
              <button
                type="button"
                className="login-form__forgot-btn"
                onClick={() => setForgotHint((v) => !v)}
              >
                Esqueceu a senha?
              </button>
            </div>

            {forgotHint && (
              <p className="login-form__hint">
                Solicite a redefinição ao administrador do painel.
              </p>
            )}

            {error && (
              <p className="login-form__error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="login-form__submit"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'ENTRAR'}
            </button>
          </form>

          <p className="login-tagline">
            Usando <span className="login-tagline__highlight">Open Finance</span> para gerar{' '}
            <span className="login-tagline__highlight">Inteligência de dados</span>
          </p>
        </div>
      </div>
    </div>
  );
}
