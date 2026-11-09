import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { registerSupplierDiagnostics } from './supplierReadOnlyDiagnostics.js';

test('normalized GPU endpoint enforces Phase 6 safety', async () => {
  const originalFetch = globalThis.fetch;
  const oldVast = process.env.VAST_API_KEY;
  const oldRunpod = process.env.RUNPOD_API_KEY;

  const app = express();
  app.use(express.json());

  // Test-only authentication. No actual owner credentials.
  registerSupplierDiagnostics(app, (req, res, next) => {
    if (req.headers['x-test-owner'] !== 'allowed') {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    next();
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => {
    if (server.listening) resolve();
    else server.once('listening', resolve);
  });

  const port = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/api/owner/gpu-price-comparison-normalized`;

  let supplierCalls = 0;
  let supplierFailure = false;
  let runpodFailure = false;

  try {
    process.env.VAST_API_KEY = 'synthetic-test-placeholder';
    process.env.RUNPOD_API_KEY = 'synthetic-test-placeholder';

    globalThis.fetch = (async (input: any, init?: any) => {
      const target = String(input);

      if (target.startsWith('https://console.vast.ai/')) {
        supplierCalls++;
        return new Response(
          supplierFailure ? '{}' : JSON.stringify({
            offers: [{
              id: 101,
              gpu_name: 'RTX 4090',
              num_gpus: 2,
              dph_total: 0.80
            }]
          }),
          {
            status: supplierFailure ? 503 : 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (target.startsWith('https://api.runpod.io/')) {
        supplierCalls++;
        if (runpodFailure) {
          return Response.json({}, { status: 503 });
        }
        return Response.json({
          data: {
            gpuTypes: [{
              id: 'NVIDIA A100',
              securePrice: 1.20
            }]
          }
        });
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    await test('unauthorized requests return 403', async () => {
      const response = await originalFetch(url);
      assert.equal(response.status, 403);
      assert.equal(supplierCalls, 0);
    });

    await test('authenticated catalog responses fail closed', async () => {
      const response = await originalFetch(url, {
        headers: { 'x-test-owner': 'allowed' }
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');

      const body = await response.json() as any;

      assert.equal(body.mode, 'READ_ONLY');
      assert.equal(body.pricingStatus, 'CATALOG_ONLY');
      assert.equal(body.confirmedAvailability, false);
      assert.equal(body.procurementBlocked, true);
      assert.equal(body.tradingBlocked, true);
      assert.equal(body.payoutsBlocked, true);
      assert.equal(body.comparisons.length, 2);

      for (const offer of body.comparisons) {
        assert.equal(offer.evidence.status, 'CATALOG_ONLY');
        assert.equal(offer.availabilityVerified, false);
        assert.equal(offer.evidence.purchasingAllowed, false);
        assert.equal(offer.evidence.paymentVerified, false);
        assert.equal(offer.evidence.eligibleForManualReview, false);
      }
    });

    await test('invalid pricing is rejected', async () => {
      const response = await originalFetch(
        url + '?customerPerGpuHourUsd=-10',
        { headers: { 'x-test-owner': 'allowed' } }
      );

      assert.equal(response.status, 400);
    });

    await test('partial supplier failure remains read-only', async () => {
      supplierFailure = true;

      const response = await originalFetch(url, {
        headers: { 'x-test-owner': 'allowed' }
      });

      assert.equal(response.status, 200);

      const body = await response.json() as any;

      assert.equal(body.mode, 'READ_ONLY');
      assert.equal(body.pricingStatus, 'CATALOG_ONLY');
      assert.equal(body.confirmedAvailability, false);
      assert.equal(body.procurementBlocked, true);
      assert.equal(body.tradingBlocked, true);
      assert.equal(body.payoutsBlocked, true);
      assert.equal(body.comparisons.length, 1);
      assert.equal(body.comparisons[0].provider, 'runpod');
      assert.equal(body.comparisons[0].evidence.purchasingAllowed, false);
      assert.equal(body.comparisons[0].evidence.paymentVerified, false);
    });

    await test('all supplier failures return safe 503', async () => {
      supplierFailure = true;
      runpodFailure = true;

      const response = await originalFetch(url, {
        headers: { 'x-test-owner': 'allowed' }
      });

      assert.equal(response.status, 503);

      const body = await response.json() as any;
      assert.equal(body.error, 'SUPPLIER_COMPARISON_UNAVAILABLE');
      assert.equal(body.procurementBlocked, true);
      assert.equal(body.tradingBlocked, true);
      assert.equal(body.payoutsBlocked, true);
      assert.equal(JSON.stringify(body).includes('synthetic-test-placeholder'), false);
    });

  } finally {
    globalThis.fetch = originalFetch;

    if (oldVast === undefined) delete process.env.VAST_API_KEY;
    else process.env.VAST_API_KEY = oldVast;

    if (oldRunpod === undefined) delete process.env.RUNPOD_API_KEY;
    else process.env.RUNPOD_API_KEY = oldRunpod;

    await new Promise<void>((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});
