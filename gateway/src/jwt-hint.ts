export function unverifiedFirebaseTenant(idToken: string): string | null {
  try {
    const payloadSegment = idToken.split('.')[1];
    if (!payloadSegment) return null;
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
      firebase?: { tenant?: unknown };
    };
    const tenant = payload.firebase?.tenant;
    return typeof tenant === 'string' && tenant.trim() ? tenant.trim() : null;
  } catch {
    return null;
  }
}
