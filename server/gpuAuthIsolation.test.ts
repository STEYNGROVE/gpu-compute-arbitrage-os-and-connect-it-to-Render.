process.env.STRICT_AUTH_ENFORCEMENT = 'true';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { requireOwnerAuth } from './auth.js';

test('owner authentication rejects invalid requests', async () => {
  const app = express();

  app.get('/auth-test', requireOwnerAuth, (_req, res) => {
    res.json({ protected: true });
  });

  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise<void>(resolve => {
      if (server.listening) resolve();
      else server.once('listening', resolve);
    });

    const port = (server.address() as AddressInfo).port;

    const response = await fetch(
      `http://127.0.0.1:${port}/auth-test`,
      {
        headers: {
          Authorization: 'Bearer deliberately-invalid-token'
        }
      }
    );

    const body = await response.json();

    console.log('ISOLATION_RESULT', response.status, body);

    assert.equal(response.status, 403);
    assert.equal(body.error, 'OWNER_AUTHENTICATION_REQUIRED');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});
