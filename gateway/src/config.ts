import 'dotenv/config';

export type UpstreamAuthMode = 'forward-firebase' | 'service-token' | 'none';

function booleanValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function upstreamAuthMode(value: string | undefined): UpstreamAuthMode {
  if (value === 'service-token' || value === 'none' || value === 'forward-firebase') {
    return value;
  }
  return 'forward-firebase';
}

const springBackendUrl = process.env.SPRING_BACKEND_URL ?? 'http://localhost:8083';
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  port: positiveInteger(process.env.PORT, 3001),
  springBackendUrl: springBackendUrl.replace(/\/+$/, ''),
  corsOrigins,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseTenantClaim: process.env.FIREBASE_TENANT_CLAIM?.trim() || 'tenant_id',
  requireTenant: booleanValue(process.env.REQUIRE_TENANT, true),
  verifyRevokedTokens: booleanValue(process.env.VERIFY_REVOKED_TOKENS, true),
  upstreamAuthMode: upstreamAuthMode(process.env.UPSTREAM_AUTH_MODE),
  upstreamServiceToken: process.env.UPSTREAM_SERVICE_TOKEN?.trim(),
  gatewaySharedSecret: process.env.GATEWAY_SHARED_SECRET?.trim(),
  proxyTimeoutMs: positiveInteger(process.env.PROXY_TIMEOUT_MS, 30_000),
} as const;

if (config.upstreamAuthMode === 'service-token' && !config.upstreamServiceToken) {
  throw new Error('UPSTREAM_SERVICE_TOKEN é obrigatório quando UPSTREAM_AUTH_MODE=service-token.');
}
