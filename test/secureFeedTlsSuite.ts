import assert from 'node:assert/strict';
import https from 'node:https';
import { readFileSync } from 'node:fs';

const key = readFileSync('test/fixtures/tls/server.key');
const cert = readFileSync('test/fixtures/tls/server.crt');

async function main() {
  const server = https.createServer(
    { key, cert },
    (_req, res) => {
      res.writeHead(200);
      res.end('TLS_OK');
    }
  );

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('NO_SERVER_ADDRESS');
  }

  const port = address.port;

  function request(
    servername: string,
    trusted: boolean
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get({
        hostname: '127.0.0.1',
        port,
        path: '/',
        servername,
        rejectUnauthorized: true,
        ...(trusted ? { ca: cert } : {}),
        agent: false,
        timeout: 3000
      }, res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () =>
          resolve(Buffer.concat(chunks).toString())
        );
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  try {
    await assert.rejects(
      request('localhost', false),
      /self.signed|certificate|CERT_/i
    );
    console.log('PASS: Untrusted certificate rejected');

    await assert.rejects(
      request('wrong.example.com', true),
      /hostname|altname|CERT_/i
    );
    console.log('PASS: TLS hostname mismatch rejected');

    assert.equal(
      await request('localhost', true),
      'TLS_OK'
    );
    console.log('PASS: Trusted matching certificate accepted');

    console.log('TLS SECURITY SUITE: ALL PASSED');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
