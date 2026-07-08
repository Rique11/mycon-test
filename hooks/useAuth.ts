/**
 * useAuth.ts — Hook de autenticação que detecta e gerencia tokens, sincronizado
 * entre abas via evento storage e dentro da aba via AUTH_TOKENS_EVENT.
 */

import React from 'react';
import { getAccessToken, clearTokens, AUTH_TOKENS_EVENT } from '../services/api';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    return getAccessToken() !== null;
  });

  React.useEffect(() => {
    const handleTokensUpdated = () => {
      setIsAuthenticated(getAccessToken() !== null);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'access_token' || event.key === 'refresh_token') {
        handleTokensUpdated();
      }
    };

    window.addEventListener(AUTH_TOKENS_EVENT, handleTokensUpdated);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(AUTH_TOKENS_EVENT, handleTokensUpdated);
      window.removeEventListener('storage', handleStorage);
    };
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
