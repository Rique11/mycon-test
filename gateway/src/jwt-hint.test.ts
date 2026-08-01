import assert from 'node:assert/strict';
import test from 'node:test';
import { unverifiedFirebaseTenant } from './jwt-hint.js';

function tokenWithPayload(payload: unknown): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

test('lê a dica de tenant nativo do payload Firebase', () => {
  assert.equal(
    unverifiedFirebaseTenant(tokenWithPayload({ firebase: { tenant: 'tenant-a' } })),
    'tenant-a',
  );
});

test('não aceita dica de tenant ausente ou JWT malformado', () => {
  assert.equal(unverifiedFirebaseTenant(tokenWithPayload({ firebase: {} })), null);
  assert.equal(unverifiedFirebaseTenant('not-a-jwt'), null);
});
