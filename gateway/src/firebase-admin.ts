import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { config } from './config.js';
import { unverifiedFirebaseTenant } from './jwt-hint.js';

const adminApp =
  getApps()[0] ??
  initializeApp({
    credential: applicationDefault(),
    projectId: config.firebaseProjectId,
  });

export const adminAuth = getAuth(adminApp);

export function verifyFirebaseIdToken(
  idToken: string,
  checkRevoked: boolean,
): Promise<DecodedIdToken> {
  // O tenant lido aqui é somente uma dica para escolher o verificador. O
  // TenantAwareAuth confirma criptograficamente que o token pertence a ele.
  const tenantHint = unverifiedFirebaseTenant(idToken);
  const verifier = tenantHint
    ? adminAuth.tenantManager().authForTenant(tenantHint)
    : adminAuth;
  return verifier.verifyIdToken(idToken, checkRevoked);
}
