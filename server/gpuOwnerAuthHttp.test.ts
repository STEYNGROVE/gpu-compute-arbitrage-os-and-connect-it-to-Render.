process.env.STRICT_AUTH_ENFORCEMENT = 'true';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { requireOwnerAuth } from './auth.js';
import { registerSupplierDiagnostics } from './supplierReadOnlyDiagnostics.js';

test('real owner middleware protects GPU comparison', async () => {
  const app = express();

  registerSupplierDiagnostics(app, requireOwnerAuth);

  const server = app.listen(0, '127.0.0.1');

  await new Promise<void>(resolve => {
    if (server.listening) resolve();
    else server.once('listening', resolve);
  });

  const port = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/api/owner/gpu-price-comparison-normalized`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer deliberately-invalid-test-token',
        'X-Owner-Api-Key': 'deliberately-invalid-test-key',
        'Cookie': 'session=deliberately-invalid-session'
      }
    });

    console.log(
      'AUTH_DIAGNOSTIC',
      response.status,
      await response.clone().text()
    );

    assert.equal(response.status, 403);

    const body = await response.json() as any;

    assert.equal(
      body.error,
      'OWNER_AUTHENTICATION_REQUIRED'
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});
