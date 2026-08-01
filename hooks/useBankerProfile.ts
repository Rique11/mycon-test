/**
 * useBankerProfile.ts — Hook para carregar o perfil do operador autenticado
 * (GET /bankers/me: nome, e-mail decifrado), com cache em memória por sessão.
 * O Sidebar aparece em todas as telas e o perfil não muda durante a sessão,
 * então a API é consultada uma única vez; troca de tokens (login/logout)
 * invalida o cache e refaz a busca apenas quando há sessão ativa.
 */

import React from 'react';
import { bankerApi } from '../services/api';
import { AUTH_STATE_EVENT, getCurrentUser } from '../services/firebase';

export interface BankerProfile {
  id?: string;
  name?: string;
  email?: string;
  active?: boolean;
}

let cachedProfile: BankerProfile | null = null;
let inflight: Promise<BankerProfile | null> | null = null;

function fetchProfile(): Promise<BankerProfile | null> {
  if (!getCurrentUser()) return Promise.resolve(null);
  if (!inflight) {
    inflight = (bankerApi.getMe() as Promise<BankerProfile>)
      .then((profile) => {
        cachedProfile = profile ?? null;
        return cachedProfile;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useBankerProfile(): BankerProfile | null {
  const [profile, setProfile] = React.useState<BankerProfile | null>(cachedProfile);

  React.useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchProfile().then((result) => {
        if (!cancelled && result) setProfile(result);
      });
    };

    if (!cachedProfile) load();

    const handleTokensUpdated = () => {
      cachedProfile = null;
      if (!cancelled) setProfile(null);
      if (getCurrentUser()) load();
    };

    window.addEventListener(AUTH_STATE_EVENT, handleTokensUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_STATE_EVENT, handleTokensUpdated);
    };
  }, []);

  return profile;
}
