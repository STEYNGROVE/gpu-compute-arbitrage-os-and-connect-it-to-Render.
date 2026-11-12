import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { registerSupplierDiagnostics } from '../server/supplierReadOnlyDiagnostics.js';

const originalFetch = globalThis.fetch;
const originalVast = process.env.VAST_API_KEY;
const originalRunpod = process.env.RUNPOD_API_KEY;

const app = express();
const ownerKey = 'synthetic-owner-test-key';

registerSupplierDiagnostics(app, (req, res, next) => {
  if (req.headers.authorization === `Bearer ${ownerKey}`) {
    return next();
  }
  res.status(401).json({ error: 'UNAUTHORIZED' });
});

const server = http.createServer(app);

try {
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('TEST_SERVER_UNAVAILABLE');
  }

  const url = `http://127.0.0.1:${address.port}/api/owner/supplier-diagnostics`;

  // Preserve local HTTP requests while mocking supplier traffic.
  globalThis.fetch = (async (input: any, init?: any) => {
    const target = String(input);

    if (target.startsWith('http://127.0.0.1:')) {
      return originalFetch(input, init);
    }

    if (!target.startsWith('https://console.vast.ai/') &&
        target !== 'https://api.runpod.io/graphql') {
      throw new Error('UNEXPECTED_EXTERNAL_REQUEST');
    }

    const isVast = target.includes('vast.ai');
    const identity = isVast
      ? target.includes('users/current')
      : String(init?.body).includes('myself');

    return new Response(JSON.stringify(isVast
        ? identity ? { id: 42 } : { offers: [{ dph_total: 0.9 }] }
        : identity
          ? { data: { myself: { id: 'test' } } }
          : { data: { gpuTypes: [{ id: 'A100', securePrice: 1.5 }] } }
    ), {status:200});
  }) as typeof fetch;

  const unauthorized = await fetch(url);
  assert.equal(unauthorized.status, 401);

  async function check(expected: string, verified: boolean) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${ownerKey}` }
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');

    const body = await response.json() as any;
    assert.equal(body.mode, 'READ_ONLY');

    for (const key of ['procurementBlocked', 'tradingBlocked', 'payoutsBlocked']) {
      assert.equal(body[key], true);
    }
    assert.equal(body.confirmedAvailability, false);
    assert.equal(body.suppliers.length, 2);

    for (const supplier of body.suppliers) {
      assert.equal(supplier.healthStatus, expected);
      assert.equal(supplier.inventoryVerified, verified);
      assert.equal(supplier.confirmedAvailability, false);
      assert.equal(supplier.evidenceFreshness, 'CURRENT_PROBE');
      assert.equal(supplier.readOnly, true);
      assert.equal(supplier.procurementBlocked, true);
      assert.equal(supplier.tradingBlocked, true);
      assert.equal(supplier.payoutsBlocked, true);
    }
  }

  delete process.env.VAST_API_KEY;
  delete process.env.RUNPOD_API_KEY;
  await check('NOT_CONFIGURED', false);

  process.env.VAST_API_KEY = 'synthetic-vast-key';
  process.env.RUNPOD_API_KEY = 'synthetic-runpod-key';
  await check('HEALTHY', true);

  globalThis.fetch = (async (input: any, init?: any) => {
    if (String(input).startsWith('http://127.0.0.1:')) {
      return originalFetch(input, init);
    }
    throw new Error('SYNTHETIC_SUPPLIER_FAILURE');
  }) as typeof fetch;

  await check('DEGRADED', false);

  console.log('PASS: Phase 8 owner endpoint regression tests');
} finally {
  globalThis.fetch = originalFetch;

  if (originalVast === undefined) delete process.env.VAST_API_KEY;
  else process.env.VAST_API_KEY = originalVast;

  if (originalRunpod === undefined) delete process.env.RUNPOD_API_KEY;
  else process.env.RUNPOD_API_KEY = originalRunpod;

  server.close();
}
