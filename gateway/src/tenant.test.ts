import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { resolveAuthorizedTenant, TenantAuthorizationError } from './tenant.js';

function token(claims: Record<string, unknown>): DecodedIdToken {
  return {
    uid: 'user-1',
    aud: '',
    auth_time: 0,
    exp: 0,
    firebase: { identities: {}, sign_in_provider: 'password' },
    iat: 0,
    iss: '',
    sub: '',
    ...claims,
  };
}

test('aceita tenant vindo de custom claim', () => {
  const result = resolveAuthorizedTenant(token({ tenant_id: 'tenant-a' }), undefined, 'tenant_id', true);
  assert.equal(result, 'tenant-a');
});

test('aceita o tenant nativo do Firebase Authentication', () => {
  const result = resolveAuthorizedTenant(
    token({ firebase: { identities: {}, sign_in_provider: 'password', tenant: 'tenant-b' } }),
    'tenant-b',
    'tenant_id',
    true,
  );
  assert.equal(result, 'tenant-b');
});

test('bloqueia tentativa de acessar outro tenant', () => {
  assert.throws(
    () => resolveAuthorizedTenant(token({ tenant_id: 'tenant-a' }), 'tenant-b', 'tenant_id', true),
    (error) => error instanceof TenantAuthorizationError && error.status === 403,
  );
});

test('bloqueia usuário sem tenant quando ele é obrigatório', () => {
  assert.throws(
    () => resolveAuthorizedTenant(token({}), undefined, 'tenant_id', true),
    (error) => error instanceof TenantAuthorizationError && error.status === 403,
  );
});
