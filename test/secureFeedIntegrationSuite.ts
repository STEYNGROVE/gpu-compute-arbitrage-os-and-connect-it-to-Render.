import assert from 'node:assert/strict';
import { secureFeedFetch, isPublicIPv4 } from '../server/secureFeedFetch.ts';

async function expectRejection(
  url: string,
  expectedError: string
) {
  await assert.rejects(
    secureFeedFetch(url),
    (error: unknown) =>
      error instanceof Error &&
      error.message === expectedError
  );
}

async function main() {
  assert.equal(isPublicIPv4('127.0.0.1'), false);
  assert.equal(isPublicIPv4('192.168.1.1'), false);
  assert.equal(isPublicIPv4('8.8.8.8'), true);

  await expectRejection(
    'http://example.com/feed',
    'UNSAFE_FEED_URL'
  );

  await expectRejection(
    'https://localhost/feed',
    'UNSAFE_FEED_URL'
  );

  await expectRejection(
    'https://127.0.0.1/feed',
    'UNSAFE_FEED_URL'
  );

  console.log('PASS: Initial feed security regression suite');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
