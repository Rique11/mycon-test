import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  onIdTokenChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

export const AUTH_STATE_EVENT = 'auth:firebase-state-updated';

const requiredFirebaseEnvironment = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseEnvironment = Object.entries(requiredFirebaseEnvironment)
  .filter(([, value]) => !value?.trim())
  .map(([name]) => name);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'unconfigured-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'unconfigured-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'unconfigured-app',
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

const firebaseTenantId = import.meta.env.VITE_FIREBASE_TENANT_ID?.trim();
if (firebaseTenantId) {
  firebaseAuth.tenantId = firebaseTenantId;
}

void setPersistence(firebaseAuth, browserLocalPersistence);

onIdTokenChanged(firebaseAuth, () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT));
  }
});

export function getCurrentUser(): User | null {
  return firebaseAuth.currentUser;
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

export async function loginWithFirebase(email: string, password: string): Promise<User> {
  if (missingFirebaseEnvironment.length > 0) {
    throw new Error(
      `Firebase não configurado. Preencha: ${missingFirebaseEnvironment.join(', ')}.`,
    );
  }
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return credential.user;
}

export function logoutFromFirebase(): Promise<void> {
  return signOut(firebaseAuth);
}

export function firebaseAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('Firebase não configurado.')) {
    return error.message;
  }

  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-mail ou senha inválidos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/user-disabled':
      return 'Este usuário está desativado.';
    case 'auth/network-request-failed':
      return 'Não foi possível conectar ao Firebase.';
    case 'auth/tenant-id-mismatch':
      return 'O usuário não pertence ao tenant configurado.';
    default:
      return 'Erro ao fazer login.';
  }
}
