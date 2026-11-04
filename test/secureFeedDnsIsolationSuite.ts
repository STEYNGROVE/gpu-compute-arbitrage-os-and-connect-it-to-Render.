import assert from 'node:assert/strict';
import {
  secureFeedFetch,
  type FeedDnsResolver
} from '../server/secureFeedFetch.ts';

async function main() {
  let calls = 0;

  const fakeResolver: FeedDnsResolver = async () => {
    calls++;
    return [
      { address: '127.0.0.1', family: 4 }
    ];
  };

  await assert.rejects(
    secureFeedFetch(
      'https://example.com/feed',
      fakeResolver
    ),
    /UNSAFE_FEED_DNS/
  );

  assert.equal(calls, 1);

  console.log('PASS: Controlled private DNS rejected');
  console.log('PASS: DNS resolver called exactly once');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
