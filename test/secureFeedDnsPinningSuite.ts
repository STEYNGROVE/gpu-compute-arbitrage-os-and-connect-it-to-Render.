import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { secureFeedFetch } from '../server/secureFeedFetch';

async function main() {
  let pinnedAddress = '';
  let tlsServername = '';
  let requestHostname = '';

  const resolver = async () => [
    { address: '8.8.8.8', family: 4 }
  ];

  const transport = ((url: any, options: any, callback: any) => {
    requestHostname = url.hostname;
    tlsServername = options.servername;

    options.lookup(
      url.hostname,
      { family: 4 },
      (error: Error | null, address: string) => {
        assert.equal(error, null);
        pinnedAddress = address;
      }
    );

    const req = new EventEmitter() as any;

    req.end = () => {
      const res = new EventEmitter() as any;
      res.statusCode = 200;
      res.headers = {};

      callback(res);

      process.nextTick(() => {
        res.emit('data', Buffer.from('<rss>OK</rss>'));
        res.emit('end');
      });
    };

    req.destroy = () => {};
    return req;
  }) as any;

  const body = await secureFeedFetch(
    'https://example.com/feed.xml',
    resolver as any,
    transport
  );

  assert.equal(body, '<rss>OK</rss>');
  assert.equal(pinnedAddress, '8.8.8.8');
  assert.equal(tlsServername, 'example.com');
  assert.equal(requestHostname, 'example.com');

  console.log('PASS: DNS address pinned');
  console.log('PASS: TLS hostname preserved');
  console.log('DNS PINNING SUITE: ALL PASSED');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
