import assert from 'node:assert/strict';
import express from 'express';
// Isolate this process before dynamically importing auth/repositories. Never inherit a DB target.
process.env.NODE_ENV = 'test';
process.env.DISABLE_JSON_PERSISTENCE = 'true';
process.env.STRICT_AUTH_ENFORCEMENT = 'true';
process.env.OWNER_API_KEY = 'phase18-synthetic-owner-key-only';
delete process.env.DATABASE_URL;
const { requireOwnerAuth, createBrowserSession, revokeBrowserSession,
  authenticateAndCreateSession, getEffectiveOwnerKey, assertOrderOwnership } = await import('../server/auth.js');
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
  const owner = createBrowserSession('OWNER');
  assert.equal((await fetch(url, { headers: { 'X-Session-Id': owner.sessionId } })).status, 200);
  revokeBrowserSession(owner.sessionId);
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
