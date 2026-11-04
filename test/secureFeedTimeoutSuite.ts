import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ClientRequest } from 'node:http';
import {
  secureFeedFetch,
  type FeedDnsResolver,
  type FeedHttpsTransport
} from '../server/secureFeedFetch.ts';

const url = 'https://example.com/feed';

const dns: FeedDnsResolver = async () => [
  { address: '8.8.8.8', family: 4 }
];

type Scenario = 'timeout' | 'error';

function transportFor(
  scenario: Scenario
): FeedHttpsTransport {
  const transport = (
    _url: URL,
    options: any,
    _onResponse: any
  ): ClientRequest => {
    assert.equal(options.rejectUnauthorized, true);

    const request = new EventEmitter() as ClientRequest;

    request.destroy = ((error?: Error) => {
      queueMicrotask(() => {
        request.emit(
          'error',
          error ?? new Error('REQUEST_DESTROYED')
        );
      });
      return request;
    }) as ClientRequest['destroy'];

    request.end = (() => {
      queueMicrotask(() => {
        if (scenario === 'timeout') {
          request.emit('timeout');
        } else {
          request.emit(
            'error',
            new Error('SIMULATED_NETWORK_FAILURE')
          );
        }
      });
      return request;
    }) as ClientRequest['end'];

    return request;
  };

  return transport as unknown as FeedHttpsTransport;
}

async function main() {
  await assert.rejects(
    secureFeedFetch(
      url,
      dns,
      transportFor('timeout')
    ),
    /FEED_TIMEOUT/
  );

  console.log('PASS: Transport timeout rejected');

  await assert.rejects(
    secureFeedFetch(
      url,
      dns,
      transportFor('error')
    ),
    /SIMULATED_NETWORK_FAILURE/
  );

  console.log('PASS: Network failure rejected');

  const stalledDns: FeedDnsResolver =
    async () => new Promise(() => {});

  const started = Date.now();

  const keepAlive = setInterval(() => {}, 1000);

  try {
    await assert.rejects(
      secureFeedFetch(url, stalledDns),
      /FEED_DNS_TIMEOUT/
    );
  } finally {
    clearInterval(keepAlive);
  }

  const elapsed = Date.now() - started;

  assert.ok(
    elapsed >= 8000 && elapsed < 15000,
    `Unexpected DNS timeout: ${elapsed}ms`
  );

  console.log('PASS: DNS timeout enforced');
  console.log('PASS: Timeout duration verified');
  console.log('TIMEOUT SECURITY SUITE: ALL PASSED');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
