import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { registerSupplierDiagnostics } from '../server/supplierReadOnlyDiagnostics.js';

const app = express();
app.use(express.json());

const testKey = 'synthetic-owner-key';

registerSupplierDiagnostics(app, (req, res, next) => {
  if (req.headers['x-owner-api-key'] !== testKey) {
    res.status(403).json({
      error: 'OWNER_AUTHENTICATION_REQUIRED'
    });
    return;
  }
  next();
});

const server = createServer(app);

async function main() {
  await new Promise<void>(resolve =>
    server.listen(0, '127.0.0.1', resolve)
  );

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('TEST_SERVER_ADDRESS_UNAVAILABLE');
  }

  const url =
    `http://127.0.0.1:${address.port}/api/owner/gpu-demand-match`;

  const originalFetch = globalThis.fetch;
  let supplierCalls = 0;

  const valid = {
    gpuModel: 'RTX 4090',
    gpuCount: 1,
    durationHours: 24,
    maxCustomerPricePerGpuHourUsd: 3,
    additionalCostPerGpuHourUsd: 0.25
  };

  try {
    globalThis.fetch = (async () => {
      supplierCalls++;
      throw new Error('SUPPLIER_NETWORK_DISABLED_IN_TEST');
    }) as typeof fetch;

    async function request(
      body: unknown,
      authenticated = true
    ) {
      return originalFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authenticated
            ? { 'X-Owner-Api-Key': testKey }
            : {})
        },
        body: JSON.stringify(body)
      });
    }

    const unauthorized = await request(valid, false);
    assert.equal(unauthorized.status, 403);
    assert.equal(supplierCalls, 0);

    const invalidCases = [
      { ...valid, gpuModel: '' },
      { ...valid, gpuCount: 0 },
      { ...valid, gpuCount: 129 },
      { ...valid, gpuCount: 1.5 },
      { ...valid, durationHours: 0 },
      { ...valid, durationHours: 8761 },
      { ...valid, maxCustomerPricePerGpuHourUsd: -1 },
      { ...valid, additionalCostPerGpuHourUsd: -1 },
      { ...valid, additionalCostPerGpuHourUsd: 10001 },
      []
    ];

    for (const body of invalidCases) {
      const response = await request(body);
      assert.equal(response.status, 400);
      assert.equal(
        (await response.json()).error,
        'INVALID_CUSTOMER_REQUIREMENT'
      );
    }

    assert.equal(
      supplierCalls,
      0,
      'Invalid requests must never reach suppliers'
    );

    const unavailable = await request(valid);
    assert.equal(unavailable.status, 503);

    const failure = await unavailable.json();

    assert.equal(
      failure.error,
      'DEMAND_MATCHING_UNAVAILABLE'
    );
    assert.equal(failure.mode, 'READ_ONLY');
    assert.equal(failure.procurementBlocked, true);
    assert.equal(failure.tradingBlocked, true);
    assert.equal(failure.payoutsBlocked, true);
    assert.equal(
      unavailable.headers.get('cache-control'),
      'no-store'
    );

    console.log(
      'PASS: GPU demand API authentication, validation, supplier failure and safety flags'
    );
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) =>
      server.close(error =>
        error ? reject(error) : resolve()
      )
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
