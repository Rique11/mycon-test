import { createHmac } from 'node:crypto';

export interface TrustedIdentity {
  uid: string;
  email: string | null;
  tenantId: string | null;
}

export const TRUSTED_IDENTITY_HEADERS = [
  'x-tenant-id',
  'x-authenticated-user-id',
  'x-authenticated-user-email',
  'x-gateway-timestamp',
  'x-gateway-signature',
] as const;

export function signaturePayload(identity: TrustedIdentity, timestamp: string): string {
  return [timestamp, identity.uid, identity.tenantId ?? '', identity.email ?? ''].join('\n');
}

export function signIdentity(
  identity: TrustedIdentity,
  timestamp: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(signaturePayload(identity, timestamp), 'utf8')
    .digest('hex');
}
