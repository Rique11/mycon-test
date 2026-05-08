/**
 * useAuth.ts — Hook de autenticação que detecta e gerencia tokens.
 */

import React from 'react';
import { getAccessToken, setTokens, clearTokens, AUTH_TOKENS_EVENT } from '../services/api';
import type { TokenPair } from '../services/api';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    return getAccessToken() !== null;
  });

  React.useEffect(() => {
    const handleTokensUpdated = () => {
      setIsAuthenticated(getAccessToken() !== null);
    };

    window.addEventListener(AUTH_TOKENS_EVENT, handleTokensUpdated);
    return () => window.removeEventListener(AUTH_TOKENS_EVENT, handleTokensUpdated);
  }, []);

  const logout = React.useCallback(() => {
    clearTokens();
    window.location.href = '/';
  }, []);

  return {
    isAuthenticated,
    logout,
  };
}
