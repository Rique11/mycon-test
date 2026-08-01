/**
 * Estado de autenticação mantido pelo Firebase. onIdTokenChanged também cobre
 * restauração da sessão e renovação automática do ID token.
 */

import React from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { firebaseAuth, logoutFromFirebase } from '../services/firebase';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(
    () =>
      onIdTokenChanged(firebaseAuth, (user) => {
        setIsAuthenticated(Boolean(user));
        setIsLoading(false);
      }),
    [],
  );

  const logout = React.useCallback(async () => {
    await logoutFromFirebase();
    window.location.href = '/';
  }, []);

  return {
    isAuthenticated,
    isLoading,
    logout,
  };
}
