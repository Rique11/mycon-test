import type { DecodedIdToken } from 'firebase-admin/auth';

export class TenantAuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'TenantAuthorizationError';
  }
}

function claimAsString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function resolveAuthorizedTenant(
  token: DecodedIdToken,
  requestedTenant: string | undefined,
  claimName: string,
  requireTenant: boolean,
): string | null {
  const customClaimTenant = claimAsString(token[claimName]);
  const firebaseTenant = claimAsString(token.firebase?.tenant);

  if (customClaimTenant && firebaseTenant && customClaimTenant !== firebaseTenant) {
    throw new TenantAuthorizationError(403, 'Claims de tenant conflitantes.');
  }

  const authorizedTenant = firebaseTenant ?? customClaimTenant;
  if (requireTenant && !authorizedTenant) {
    throw new TenantAuthorizationError(403, 'Usuário sem tenant autorizado.');
  }

  const normalizedRequestedTenant = claimAsString(requestedTenant);
  if (
    normalizedRequestedTenant &&
    (!authorizedTenant || normalizedRequestedTenant !== authorizedTenant)
  ) {
    throw new TenantAuthorizationError(403, 'Usuário não pertence ao tenant solicitado.');
  }

  return authorizedTenant;
}
