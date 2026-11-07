import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { FeedHttpsTransport } from '../server/secureFeedFetch.ts';
import { secureFeedFetch } from '../server/secureFeedFetch.ts';

async function main() {
  let calls = 0;

  const transport = ((url: URL, options: any, callback: any) => {
    assert.equal(url.hostname, 'example.com');
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, 'example.com');

    for (const all of [true, false]) {
      options.lookup('example.com', { all }, (
        error: Error | null,
        result: any,
        family?: number
      ) => {
        assert.equal(error, null);

        if (all) {
          assert.deepEqual(result, [
            { address: '8.8.8.8', family: 4 }
          ]);
        } else {
          assert.equal(result, '8.8.8.8');
          assert.equal(family, 4);
        }

        calls++;
      });
    }

    const request = new EventEmitter() as any;

    request.end = () => {
      queueMicrotask(() => {
        const response = new EventEmitter() as any;
        response.statusCode = 200;
        response.destroy = () => {};
        callback(response);

        queueMicrotask(() => {
          response.emit('data', Buffer.from('OK'));
          response.emit('end');
        });
      });
    };

    request.destroy = () => {};

    return request;
  }) as FeedHttpsTransport;

  const result = await secureFeedFetch(
    'https://example.com/feed',
    async () => [{ address: '8.8.8.8', family: 4 }],
    transport
  );

  assert.equal(result, 'OK');
  assert.equal(calls, 2);

  console.log('PASS: Production lookup all:true');
  console.log('PASS: Production lookup all:false');
  console.log('PASS: Pinned address preserved');
  console.log('PASS: TLS verification remains enabled');
  console.log('NODE24 PRODUCTION SUITE: ALL PASSED');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
