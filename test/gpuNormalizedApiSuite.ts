import assert from 'node:assert/strict';
import express from 'express';
import {
  registerSupplierDiagnostics
} from '../server/supplierReadOnlyDiagnostics.js';

async function main() {
  const oldVast = process.env.VAST_API_KEY;
  const oldRunpod = process.env.RUNPOD_API_KEY;

  const app = express();

  registerSupplierDiagnostics(app, (req, res, next) => {
    if (req.headers['x-test-owner'] !== 'yes') {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    next();
  });

  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise<void>(resolve =>
      server.once('listening', resolve)
    );

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('TEST_SERVER_ADDRESS_MISSING');
    }

    const base =
      `http://127.0.0.1:${address.port}` +
      '/api/owner/gpu-price-comparison-normalized';

    const unauthorized = await fetch(base);
    assert.equal(unauthorized.status, 401);

    const invalid = [
      '?customerPerGpuHourUsd=-1',
      '?customerPerGpuHourUsd=0',
      '?customerPerGpuHourUsd=abc',
      '?customerPerGpuHourUsd=',
      '?additionalCostPerGpuHourUsd=-1',
      '?additionalCostPerGpuHourUsd=abc',
      '?additionalCostPerGpuHourUsd='
    ];

    for (const query of invalid) {
      const response = await fetch(base + query, {
        headers: { 'x-test-owner': 'yes' }
      });
      assert.equal(response.status, 400, query);
    }

    delete process.env.VAST_API_KEY;
    delete process.env.RUNPOD_API_KEY;

    const unavailable = await fetch(base, {
      headers: { 'x-test-owner': 'yes' }
    });

    assert.equal(unavailable.status, 503);

    const body = await unavailable.json();

    assert.equal(
      body.error,
      'SUPPLIER_COMPARISON_UNAVAILABLE'
    );
    assert.equal(body.procurementBlocked, true);
    assert.equal(body.tradingBlocked, true);
    assert.equal(body.payoutsBlocked, true);

    console.log(
      'PASS: normalized API authorization, ' +
      'input validation and fail-closed supplier handling'
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error =>
        error ? reject(error) : resolve()
      )
    );

    if (oldVast === undefined) {
      delete process.env.VAST_API_KEY;
    } else {
      process.env.VAST_API_KEY = oldVast;
    }

    if (oldRunpod === undefined) {
      delete process.env.RUNPOD_API_KEY;
    } else {
      process.env.RUNPOD_API_KEY = oldRunpod;
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
