import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { config } from './config.js';
import { verifyFirebaseIdToken } from './firebase-admin.js';
import {
  signIdentity,
  TRUSTED_IDENTITY_HEADERS,
  type TrustedIdentity,
} from './identity.js';
import { resolveAuthorizedTenant, TenantAuthorizationError } from './tenant.js';

declare global {
  namespace Express {
    interface Request {
      firebaseToken?: string;
      firebaseClaims?: DecodedIdToken;
      trustedIdentity?: TrustedIdentity;
    }
  }
}

function bearerToken(req: Request): string | null {
  const authorization = req.header('authorization');
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function clearUntrustedIdentityHeaders(req: Request): void {
  for (const header of TRUSTED_IDENTITY_HEADERS) {
    delete req.headers[header];
  }
}

export async function authenticateAndAuthorizeTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestedTenant = req.header('x-tenant-id');
  clearUntrustedIdentityHeaders(req);

  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'unauthorized', message: 'Bearer token ausente.' });
    return;
  }

  try {
    const claims = await verifyFirebaseIdToken(token, config.verifyRevokedTokens);
    const tenantId = resolveAuthorizedTenant(
      claims,
      requestedTenant,
      config.firebaseTenantClaim,
      config.requireTenant,
    );
    const identity: TrustedIdentity = {
      uid: claims.uid,
      email: claims.email ?? null,
      tenantId,
    };

    req.firebaseToken = token;
    req.firebaseClaims = claims;
    req.trustedIdentity = identity;
    req.headers['x-authenticated-user-id'] = identity.uid;
    if (identity.email) req.headers['x-authenticated-user-email'] = identity.email;
    if (identity.tenantId) req.headers['x-tenant-id'] = identity.tenantId;

    if (config.gatewaySharedSecret) {
      const timestamp = Date.now().toString();
      req.headers['x-gateway-timestamp'] = timestamp;
      req.headers['x-gateway-signature'] = signIdentity(
        identity,
        timestamp,
        config.gatewaySharedSecret,
      );
    }

    next();
  } catch (error) {
    if (error instanceof TenantAuthorizationError) {
      res.status(error.status).json({
        error: error.status === 401 ? 'unauthorized' : 'forbidden',
        message: error.message,
      });
      return;
    }

    res.status(401).json({
      error: 'invalid_token',
      message: 'Token Firebase inválido, expirado ou revogado.',
    });
  }
}
