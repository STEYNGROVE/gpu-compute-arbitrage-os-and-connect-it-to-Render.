import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pgDbService } from '../server/pgDatabase.js';
import { registerReadinessHealth } from '../server/readinessHealth.js';

async function main() {
  const app = express();
  registerReadinessHealth(app);

  const originalConnected =
    pgDbService.isLiveDatabaseConnected;
  const originalQuery = pgDbService.query;

  let connected = false;
  let queryFails = false;

  pgDbService.isLiveDatabaseConnected =
    () => connected;

  pgDbService.query = (async () => {
    if (queryFails) throw new Error('Simulated database outage');
    return {
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
      rows: [{ '?column?': 1 }]
    };
  }) as typeof pgDbService.query;

  const server = createServer(app);

  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server address unavailable');
    }

    const url = `http://127.0.0.1:${address.port}/api/ready`;

    async function check(expected: number) {
      const response = await fetch(url);
      const body = await response.json();

      assert.equal(response.status, expected);
      assert.equal(
        body.status,
        expected === 200 ? 'ready' : 'not_ready'
      );
      assert.equal(
        response.headers.get('cache-control'),
        'no-store'
      );
    }

    await check(503);
    console.log('PASS: Disconnected database fails closed');

    connected = true;
    await check(200);
    console.log('PASS: Connected database is ready');

    queryFails = true;
    await check(503);
    console.log('PASS: Query failure fails closed');

    queryFails = false;
    await check(200);
    console.log('PASS: Database recovery restores readiness');

    console.log('ALL READINESS TESTS PASSED');
  } finally {
    pgDbService.isLiveDatabaseConnected = originalConnected;
    pgDbService.query = originalQuery;
    server.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
