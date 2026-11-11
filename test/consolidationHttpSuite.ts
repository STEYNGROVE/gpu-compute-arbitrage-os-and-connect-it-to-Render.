import assert from 'node:assert/strict';
import express from 'express';
import { Script } from 'node:vm';
process.env.NODE_ENV = 'test';
process.env.DISABLE_JSON_PERSISTENCE = 'true';
process.env.STRICT_AUTH_ENFORCEMENT = 'true';
process.env.OWNER_API_KEY = 'consolidation-synthetic-owner-key';
delete process.env.DATABASE_URL;
delete process.env.RUNPOD_API_KEY;
delete process.env.VAST_API_KEY;
const { requireOwnerAuth, createBrowserSession } = await import('../server/auth.js');
const { rateLimit } = await import('../server/rateLimit.js');
const { financialLockdown } = await import('../server/financialLockdown.js');
const { registerH100FleetController } = await import('../server/h100FleetController.js');
const { registerSpaceStationOne } = await import('../server/spaceStationOne.js');
const { registerCommercialEvidence } = await import('../server/commercialEvidence.js');
const { registerSupplierDiagnostics } = await import('../server/supplierReadOnlyDiagnostics.js');
const app = express();
app.use(express.json());
app.use(rateLimit(200, 60000));
registerH100FleetController(app, requireOwnerAuth);
registerSpaceStationOne(app, requireOwnerAuth);
registerCommercialEvidence(app, requireOwnerAuth);
registerSupplierDiagnostics(app, requireOwnerAuth);
app.use('/api', financialLockdown);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.listening ? resolve() : server.once('listening', resolve));
const address = server.address(); assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const id = '12345678-1234-4123-8123-123456789012';
const customer = createBrowserSession('CUSTOMER', 'buyer');
const routes: Array<[string, string, unknown?]> = [
  ['GET', '/owner/space-station'],
  ['POST', '/api/owner/h100-fleet/analyze', { nodes: [] }],
  ['POST', '/api/owner/commercial-quote-plan', {}],
  ['GET', `/api/owner/commercial-evidence/${id}`],
  ['POST', `/api/owner/commercial-evidence/${id}/verification`, {state:'UNVERIFIED', evidenceReference:'', reviewNote:''}],
  ['POST', `/api/owner/commercial-evidence/${id}/quotes`, {}],
  ['POST', `/api/owner/commercial-evidence/${id}/quotes/${id}/state`, {}]
];
async function request(method: string, path: string, headers: Record<string,string>, body?: unknown) {
  return fetch(origin + path, {method, headers:{'Content-Type':'application/json', ...headers}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
}
try {
  for (const [method, path, body] of routes) {
    for (const headers of [{}, {'X-Owner-Api-Key':'invalid'}, {'X-Session-Id':customer.sessionId}]) {
      assert.equal((await request(method, path, headers, body)).status, 403, `${method} ${path}`);
    }
  }
  const headers = {'X-Owner-Api-Key':process.env.OWNER_API_KEY};
  const page = await request('GET', '/owner/space-station', headers);
  assert.equal(page.status, 200); assert.equal(page.headers.get('cache-control'), 'no-store');
  const html = await page.text();
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(match[1]);
  const fleet = await request('POST', '/api/owner/h100-fleet/analyze', headers, {nodes:[]});
  assert.equal(fleet.status, 200); const analysis = await fleet.json();
  assert.equal(analysis.controls.executionEligible, false); assert.equal(analysis.finance.evidenceVerified, false);
  assert.equal((await request('POST', '/api/owner/commercial-quote-plan', headers, {})).status, 400);
  const plan = await request('POST', '/api/owner/commercial-quote-plan', headers, {gpuModel:'H100',gpuCount:1,durationHours:1,maxCustomerPricePerGpuHourUsd:2,additionalCostUsd:0,contingencyPct:0,minimumMarginPct:30});
  assert.equal(plan.status, 503); assert.equal((await plan.json()).procurementBlocked, true);
  assert.equal((await request('GET', `/api/owner/commercial-evidence/${id}`, headers)).status, 503);
  assert.equal((await request('POST', `/api/owner/commercial-evidence/${id}/verification`, headers, {state:'UNVERIFIED',evidenceReference:'',reviewNote:''})).status, 503);
  assert.equal((await request('POST', '/api/treasury/withdraw', headers, {})).status, 423);
  console.log('PASS: all new routes reject anonymous/invalid/customer auth; dashboard JS compiles; authorized read-only and disconnected-DB behavior preserve financial lockdown');
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
