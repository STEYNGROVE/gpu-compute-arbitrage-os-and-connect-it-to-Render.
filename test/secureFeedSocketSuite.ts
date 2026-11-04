import assert from 'node:assert/strict';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import type { FeedHttpsTransport } from '../server/secureFeedFetch.ts';
import { secureFeedFetch } from '../server/secureFeedFetch.ts';

const key = readFileSync('test/fixtures/tls/server.key');
const cert = readFileSync('test/fixtures/tls/server.crt');

async function main() {
  const server = https.createServer(
    { key, cert },
    (_req, res) => {
      res.end('OK');
    }
  );

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('NO_SERVER_ADDRESS');
  }

  let pinnedAddress = '';
  let tlsHostname = '';
  let transportCalled = false;

  const transport = ((
    url: URL,
    options: any,
    callback: any
  ) => {
    transportCalled = true;

    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, 'example.com');

    tlsHostname = options.servername;

    options.lookup(
      'example.com',
      { all: false },
      (error: Error | null, ip: string) => {
        assert.ifError(error);
        pinnedAddress = ip;
      }
    );

    return https.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: url.pathname,
      method: 'GET',
      servername: options.servername,
      rejectUnauthorized: true,
      ca: cert,
      agent: false
    }, callback);
  }) as FeedHttpsTransport;

  try {
    await assert.rejects(
      secureFeedFetch(
        'https://example.com/feed',
        async () => [{ address: '8.8.8.8', family: 4 }],
        transport
      ),
      /hostname|altname|CERT_/i
    );

    assert.equal(transportCalled, true);
    assert.equal(pinnedAddress, '8.8.8.8');
    assert.equal(tlsHostname, 'example.com');

    console.log('PASS: DNS pinning option verified');
    console.log('PASS: Original TLS hostname preserved');
    console.log('PASS: Wrong certificate rejected');
    console.log('SOCKET SECURITY SUITE: ALL PASSED');
  } finally {
    server.closeAllConnections();

    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
