import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import express from 'express';
// Isolate this process before dynamically importing auth/repositories. Never inherit a DB target.
process.env.NODE_ENV = 'test';
process.env.DISABLE_JSON_PERSISTENCE = 'true';
process.env.STRICT_AUTH_ENFORCEMENT = 'true';
process.env.OWNER_API_KEY = 'phase18-synthetic-owner-key-only';
delete process.env.DATABASE_URL;
const { requireOwnerAuth, createBrowserSession, revokeBrowserSession,
  authenticateAndCreateSession, getEffectiveOwnerKey, assertOrderOwnership, studioAuthFallbackAllowed } = await import('../server/auth.js');
const app = express();
app.get('/protected', requireOwnerAuth, (_req, res) => res.json({ ok: true }));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.listening ? resolve() : server.once('listening', resolve));
try {
  const address = server.address(); assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/protected`;
  assert.equal((await fetch(url)).status, 403);
  assert.equal((await fetch(url, { headers: { 'X-Owner-Api-Key': process.env.OWNER_API_KEY } })).status, 200);
  const customer = createBrowserSession('CUSTOMER', 'buyer');
  assert.equal((await fetch(url, { headers: { 'X-Session-Id': customer.sessionId } })).status, 403);
  assert.equal((await fetch(url, { headers: { Cookie: `gpu_arb_session=${customer.sessionId}` } })).status, 403);
  const owner = createBrowserSession('OWNER');
  assert.equal((await fetch(url, { headers: { 'X-Session-Id': owner.sessionId } })).status, 200);
  assert.equal((await fetch(url, { headers: { Cookie: `gpu_arb_session=${owner.sessionId}` } })).status, 200);
  assert.equal((await fetch(`${url}?sessionId=${owner.sessionId}`)).status, 403);
  assert.equal((await fetch(`${url}?session_id=${owner.sessionId}`)).status, 403);
  assert.equal((await fetch(url, {headers:{Cookie:'gpu_arb_session=%INVALID'}})).status, 403);
  assert.match(readFileSync('server.ts', 'utf8'), /const allowAutoSession = studioAuthFallbackAllowed\(\);/, 'Legacy dev_auto route must share the fail-closed preview policy');
  const previousMode = process.env.NODE_ENV, previousStrict = process.env.STRICT_AUTH_ENFORCEMENT;
  const previousFallback = process.env.ENABLE_STUDIO_AUTH_FALLBACK;
  try {
    delete process.env.NODE_ENV;
    delete process.env.STRICT_AUTH_ENFORCEMENT;
    delete process.env.ENABLE_STUDIO_AUTH_FALLBACK;
    assert.equal((await fetch(url)).status, 403, 'Missing runtime mode must not grant owner authority');
    process.env.NODE_ENV = 'development';
    assert.equal((await fetch(url)).status, 403, 'Development preview fallback requires explicit opt-in');
    process.env.ENABLE_STUDIO_AUTH_FALLBACK = 'true';
    assert.equal(studioAuthFallbackAllowed(), true, 'Explicit development opt-in is available');
    process.env.STRICT_AUTH_ENFORCEMENT = 'true';
    assert.equal(studioAuthFallbackAllowed(), false, 'Strict auth overrides preview opt-in');
    delete process.env.STRICT_AUTH_ENFORCEMENT;
    process.env.NODE_ENV = 'production';
    assert.equal((await fetch(url)).status, 403, 'Preview opt-in cannot bypass production authentication');
  } finally {
    process.env.NODE_ENV = previousMode;
    process.env.STRICT_AUTH_ENFORCEMENT = previousStrict;
    if (previousFallback === undefined) delete process.env.ENABLE_STUDIO_AUTH_FALLBACK;
    else process.env.ENABLE_STUDIO_AUTH_FALLBACK = previousFallback;
  }
  revokeBrowserSession(owner.sessionId);
  assert.equal((await fetch(url, { headers: { Cookie: `gpu_arb_session=${owner.sessionId}` } })).status, 403);
  assert.equal((await fetch(url, { headers: { 'X-Session-Id': owner.sessionId } })).status, 403);
  const expired = createBrowserSession('OWNER'); expired.expiresAt = Date.now() - 1;
  assert.equal((await fetch(url, { headers: { 'X-Session-Id': expired.sessionId } })).status, 403);
  assert.equal(assertOrderOwnership({ customer: { customerId: 'buyer' } } as any, 'other').authorized, false);
  assert.equal(assertOrderOwnership({ customer: { customerId: 'buyer' } } as any, 'buyer').authorized, true);
  for (let i = 0; i < 5; i++) {
    const result = await authenticateAndCreateSession({ role: 'OWNER', secretOrKey: 'invalid', ip: 'phase18-offline' });
    assert.equal(result.success, false); assert.match(result.error!, /INVALID_CREDENTIALS/);
  }
  const limited = await authenticateAndCreateSession({ role: 'OWNER', secretOrKey: process.env.OWNER_API_KEY, ip: 'phase18-offline' });
  assert.equal(limited.success, false); assert.match(limited.error!, /RATE_LIMITED/);
  for (const key of ['', 'short', 'gpu-arb-owner-2026-production']) {
    process.env.OWNER_API_KEY = key;
    assert.equal(getEffectiveOwnerKey(), '');
    assert.equal((await fetch(url, { headers: { 'X-Owner-Api-Key': key || 'invalid' } })).status, 403);
  }
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
console.log('PASS: real owner/customer RBAC, owner secret fail-closed, revoked/expired sessions, tenant ownership and login throttling (local only)');
