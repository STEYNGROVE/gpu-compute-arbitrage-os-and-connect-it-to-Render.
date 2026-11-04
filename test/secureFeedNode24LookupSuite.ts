import assert from 'node:assert/strict';
import https from 'node:https';
import type { TLSSocket } from 'node:tls';
import { readFileSync } from 'node:fs';
import {
  secureFeedFetch,
  type FeedDnsResolver,
  type FeedHttpsTransport
} from '../server/secureFeedFetch.ts';

const key = readFileSync('test/fixtures/tls/server.key');
const cert = readFileSync('test/fixtures/tls/server.crt');

async function main() {
  const server = https.createServer({ key, cert }, (_req, res) => {
    res.end('NODE24_OK');
  });

  await new Promise<void>(resolve =>
    server.listen(0, '127.0.0.1', resolve)
  );

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('NO_SERVER_ADDRESS');
  }

  let lookupCalled = false;
  let remoteAddress = '';
  let tlsAuthorized = false;

  const dns: FeedDnsResolver = async () => [
    { address: '8.8.8.8', family: 4 }
  ];

  const transport = ((
    url: URL,
    options: any,
    callback: any
  ) => {
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, 'localhost-test.example.com');

    const req = https.request({
      ...options,
      hostname: 'localhost',
      port: address.port,
      path: url.pathname,
      servername: 'localhost',
      ca: cert,
      agent: false,
      lookup: (_host: string, opts: any, cb: any) => {
        lookupCalled = true;
        assert.equal(opts.all, true);
        cb(null, [{ address: '127.0.0.1', family: 4 }]);
      }
    }, callback);

    req.on('socket', socket => {
      socket.on('secureConnect', () => {
        remoteAddress = socket.remoteAddress || '';
        tlsAuthorized = (socket as TLSSocket).authorized;
      });
    });

    return req;
  }) as FeedHttpsTransport;

  try {
    const result = await secureFeedFetch(
      'https://localhost-test.example.com/feed',
      dns,
      transport
    );

    assert.equal(result, 'NODE24_OK');
    assert.equal(lookupCalled, true);
    assert.equal(remoteAddress, '127.0.0.1');
    assert.equal(tlsAuthorized, true);

    console.log('PASS: Node.js 24 lookup all:true');
    console.log('PASS: Real HTTPS socket connected');
    console.log('PASS: TLS certificate authorized');
    console.log('NODE24 LOOKUP SUITE: ALL PASSED');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
