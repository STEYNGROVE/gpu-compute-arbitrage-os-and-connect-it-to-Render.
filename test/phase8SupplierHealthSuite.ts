import assert from 'node:assert/strict';
import { probeSupplier } from '../server/supplierReadOnlyDiagnostics.js';

const originalFetch = globalThis.fetch;
const originalVast = process.env.VAST_API_KEY;
const originalRunpod = process.env.RUNPOD_API_KEY;

async function checkProbe(supplier: 'vast_ai' | 'runpod') {
  const before = Date.now();
  const result = await probeSupplier(supplier);
  const after = Date.now();

  assert.equal(result.supplier, supplier);
  assert.equal(result.readOnly, true);
  assert.equal(result.procurementBlocked, true);
  assert.ok(Number.isFinite(result.latencyMs));
  assert.ok(result.latencyMs >= 0);

  const timestamp = Date.parse(result.checkedAt);
  assert.ok(Number.isFinite(timestamp));
  assert.ok(timestamp >= before && timestamp <= after);

  return result;
}

try {
  delete process.env.VAST_API_KEY;
  delete process.env.RUNPOD_API_KEY;

  globalThis.fetch = (async () => {
    throw Error('Unexpected network request');
  }) as typeof fetch;

  for (const supplier of ['vast_ai', 'runpod'] as const) {
    const result = await checkProbe(supplier);
    assert.equal(result.configured, false);
    assert.equal(result.authenticated, false);
    assert.equal(result.errorCode, 'KEY_REQUIRED');
  }

  process.env.VAST_API_KEY = 'synthetic-vast-key';
  process.env.RUNPOD_API_KEY = 'synthetic-runpod-key';

  globalThis.fetch = (async (input: any, init: any) => {
    assert.equal(init.redirect, 'error');

    const url = String(input);
    const isVast = url.includes('vast.ai');
    const isIdentity = isVast
      ? url.includes('users/current')
      : String(init.body).includes('myself');

    const data = isVast
      ? isIdentity
        ? { id: 42 }
        : { offers: [{ dph_total: 0.9 }] }
      : isIdentity
        ? { data: { myself: { id: 'test' } } }
        : { data: { gpuTypes: [{ id: 'A100', securePrice: 1.5 }] } };

    return {
      ok: true,
      status: 200,
      json: async () => data
    } as Response;
  }) as typeof fetch;

  for (const supplier of ['vast_ai', 'runpod'] as const) {
    const result = await checkProbe(supplier);
    assert.equal(result.authenticated, true);
    assert.equal(result.errorCode, null);
    assert.equal(result.inventoryRecords, 1);
    assert.equal(result.pricedRecords, 1);
  }

  globalThis.fetch = (async () => {
    throw Error('Synthetic supplier outage');
  }) as typeof fetch;

  for (const supplier of ['vast_ai', 'runpod'] as const) {
    const result = await checkProbe(supplier);
    assert.equal(result.errorCode, 'NETWORK_OR_PARSE_FAILURE');
    assert.equal(result.procurementBlocked, true);
  }

  console.log('PASS: Phase 8 supplier probe regression tests');
} finally {
  globalThis.fetch = originalFetch;

  if (originalVast === undefined) delete process.env.VAST_API_KEY;
  else process.env.VAST_API_KEY = originalVast;

  if (originalRunpod === undefined) delete process.env.RUNPOD_API_KEY;
  else process.env.RUNPOD_API_KEY = originalRunpod;
}
