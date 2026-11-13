import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const STAGING = 'https://gpu-arbitrage-simulation-staging.onrender.com';
export const BASELINE = '32321cbece4ccd7c1481466c3f416adf79749e26';
const privatePaths = ['/api/owner/config', '/api/acquisition/leads',
  '/api/owner/customer-intelligence', '/api/owner/gpu-hunter-x/evidence-review',
  '/api/treasury/profit-withdrawals/status'];

// No credentials accepted, no discovery scans, login attempts, financial writes or redirects.
/**
 * Run GET-only checks and require an explicit commit identity for readiness verification.
 * @param {{request?: typeof fetch, expectedRevision?: string}} options
 */
export async function smoke({ request = fetch, expectedRevision } = {}) {
  expectedRevision ??= process.env.EXPECTED_STAGING_REVISION || process.env.GITHUB_SHA;
  assert.equal(typeof expectedRevision, 'string', 'EXPECTED_STAGING_REVISION or GITHUB_SHA is required');
  assert.match(expectedRevision, /^[a-f0-9]{40}$/, 'Expected a 40-character lowercase hexadecimal commit SHA');
  const checks = [];
  async function get(path, headers = {}) {
    const response = await request(STAGING + path, { method: 'GET', redirect: 'error',
      signal: AbortSignal.timeout(60_000), headers: { 'Cache-Control': 'no-cache', ...headers } });
    const body = await response.json();
    checks.push({ path, status: response.status, variant: Object.keys(headers).length ? 'invalid-credentials' : 'anonymous' });
    return { response, body };
  }
  for (const path of ['/healthz', '/api/healthz']) {
    const { response, body } = await get(path);
    assert.equal(response.status, 200); assert.equal(body.status, 'ok');
  }
  const { response, body } = await get('/api/ready');
  assert.equal(response.status, 200); assert.equal(body.status, 'ready');
  assert.equal(body.database, 'connected'); assert.equal(body.revision, expectedRevision);
  assert.equal(body.financialExecutionAllowed, false);
  assert.equal(body.commerciallyCertified, false);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  for (const path of privatePaths) {
    for (const headers of [{}, { Authorization: 'Bearer phase18-invalid-fixture',
      'X-Owner-Api-Key': 'phase18-invalid-fixture', 'X-Session-Id': 'sess_phase18_invalid' }]) {
      const { response, body } = await get(path, headers);
      assert.equal(response.status, 403, path);
      assert.equal(body.error, 'OWNER_AUTHENTICATION_REQUIRED', path);
    }
  }
  return { checkedAt: new Date().toISOString(), origin: STAGING, revision: body.revision,
    mode: 'GET_ONLY_NO_CREDENTIALS_NO_WRITES', checks, passed: checks.length };
}
// Assertion messages can embed untrusted response values; CLI diagnostics are codes only.
export function smokeFailureCode(error) {
  return error instanceof assert.AssertionError ? 'CONTRACT_MISMATCH' : 'REQUEST_FAILED';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  smoke()
    .then(report => console.log(JSON.stringify(report, null, 2)))
    .catch(error => { console.error('STAGING_SMOKE_FAILED:', smokeFailureCode(error)); process.exitCode = 1; });
}
