import type { Request } from 'express';
import { extractSessionIdFromRequest, validateBrowserSession, getEffectiveOwnerKey, timingSafeMatch } from './auth.js';
/** Cryptographically verified priority bucket; no forwarding header can select this identity. */
export function verifiedOwnerRateIdentity(req: Request): string | null {
  const session = extractSessionIdFromRequest(req);
  if (session && validateBrowserSession(session)?.role === 'OWNER') return 'verified-owner';
  const authorization = req.headers.authorization || '';
  let token = authorization.startsWith('Bearer ') && !authorization.startsWith('Bearer sess_')
    ? authorization.slice(7) : req.headers['x-owner-api-key'] || req.headers['x-api-key'];
  if (req.method === 'POST' && req.path.toLowerCase() === '/api/auth/login' &&
      String(req.body?.role || 'OWNER').toUpperCase() === 'OWNER') token = req.body?.secretOrKey;
  const expected = getEffectiveOwnerKey();
  return typeof token === 'string' && expected && timingSafeMatch(token.trim(), expected.trim()) ? 'verified-owner' : null;
}
