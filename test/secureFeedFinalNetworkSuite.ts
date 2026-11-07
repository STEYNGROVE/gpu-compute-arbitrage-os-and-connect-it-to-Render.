import assert from 'node:assert/strict';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import type { FeedHttpsTransport } from '../server/secureFeedFetch.ts';
import { secureFeedFetch } from '../server/secureFeedFetch.ts';

const key = readFileSync('test/fixtures/tls/server.key');
const cert = readFileSync('test/fixtures/tls/server.crt');

async function main() {
  let requestCount = 0;
  let closedSockets = 0;

  const server = https.createServer({ key, cert }, (req, res) => {
    requestCount++;

    if (req.url === '/stall') {
      res.writeHead(200);
      res.write('PARTIAL');
      return;
    }

    res.end('OK');
  });

  server.on('connection', socket => {
    socket.once('close', () => {
      closedSockets++;
    });
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('NO_SERVER_ADDRESS');
  }

  const transport: FeedHttpsTransport = ((
    url: URL,
    options: any,
    callback: any
  ) => {
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, 'example.com');

    return https.request({
      ...options,
      hostname: '127.0.0.1',
      port: address.port,
      path: url.pathname,
      ca: cert,
      servername: 'localhost',
      agent: false
    }, callback);
  }) as FeedHttpsTransport;

  try {
    const started = Date.now();

    const result = await secureFeedFetch(
      'https://example.com/stall',
      async () => [{ address: '8.8.8.8', family: 4 }],
      transport
    ).then(
      () => 'RESOLVED',
      error => String(error?.name || error?.message)
    );

    const elapsed = Date.now() - started;

    assert.notEqual(result, 'RESOLVED');
    assert.ok(
      elapsed >= 8000 && elapsed < 15000,
      `Unexpected timeout duration: ${elapsed}ms`
    );

    await new Promise(resolve => setTimeout(resolve, 250));

    assert.equal(requestCount, 1);
    assert.ok(closedSockets >= 1);

    console.log('PASS: Real HTTPS request established');
    console.log('PASS: Stalled response aborted');
    console.log('PASS: Deadline enforced');
    console.log('PASS: Socket closed after abort');
    console.log('FINAL NETWORK SUITE: ALL PASSED');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
