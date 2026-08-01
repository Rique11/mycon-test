import { adminAuth } from './firebase-admin.js';
import { config } from './config.js';

const [, , email, tenantId] = process.argv;

if (!email || !tenantId) {
  console.error('Uso: npm run tenant:set -- usuario@empresa.com tenant-id');
  process.exitCode = 1;
} else {
  const user = await adminAuth.getUserByEmail(email);
  const currentClaims = user.customClaims ?? {};
  await adminAuth.setCustomUserClaims(user.uid, {
    ...currentClaims,
    [config.firebaseTenantClaim]: tenantId,
  });
  console.log(`Tenant "${tenantId}" atribuído a ${email}.`);
  console.log('O usuário deve renovar a sessão para receber a nova claim.');
}
