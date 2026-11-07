import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import {
  secureFeedFetch,
  type FeedDnsResolver,
  type FeedHttpsTransport
} from '../server/secureFeedFetch.ts';

const dns: FeedDnsResolver = async () => [
  { address: '8.8.8.8', family: 4 }
];

type Scenario = 'success' | 'redirect' | 'oversize';

function transportFor(scenario: Scenario): FeedHttpsTransport {
  const transport = (
    _url: URL,
    options: RequestOptions,
    onResponse: (res: IncomingMessage) => void
  ): ClientRequest => {
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, 'example.com');
    assert.equal(options.agent, false);

    const request = new EventEmitter() as ClientRequest;

    request.end = (() => {
      queueMicrotask(() => {
        const response = new EventEmitter() as IncomingMessage;

        response.statusCode =
          scenario === 'redirect' ? 302 : 200;

        response.destroy = (() => response) as
          IncomingMessage['destroy'];

        onResponse(response);

        if (scenario === 'redirect') return;

        const data = scenario === 'oversize'
          ? Buffer.alloc(1024 * 1024 + 1)
          : Buffer.from('<rss>OK</rss>');

        response.emit('data', data);

        if (scenario === 'success') {
          response.emit('end');
        }
      });

      return request;
    }) as ClientRequest['end'];

    return request;
  };

  return transport as unknown as FeedHttpsTransport;
}

async function main() {
  const url = 'https://example.com/feed';

  assert.equal(
    await secureFeedFetch(url, dns, transportFor('success')),
    '<rss>OK</rss>'
  );
  console.log('PASS: HTTPS response accepted');

  await assert.rejects(
    secureFeedFetch(url, dns, transportFor('redirect')),
    /FEED_HTTP_302/
  );
  console.log('PASS: Redirect rejected');

  await assert.rejects(
    secureFeedFetch(url, dns, transportFor('oversize')),
    /FEED_TOO_LARGE/
  );
  console.log('PASS: Oversized response rejected');

  console.log('TRANSPORT SECURITY SUITE: ALL PASSED');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
