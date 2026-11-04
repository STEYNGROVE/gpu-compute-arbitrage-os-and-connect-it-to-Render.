import assert from 'node:assert/strict';
import {
  isPublicIPv4,
  secureFeedFetch
} from '../server/secureFeedFetch';

async function main() {
  const blocked = [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '255.255.255.255',
    '::1'
  ];

  for (const address of blocked) {
    assert.equal(
      isPublicIPv4(address),
      false,
      `Unsafe address accepted: ${address}`
    );
  }

  assert.equal(isPublicIPv4('8.8.8.8'), true);
  assert.equal(isPublicIPv4('1.1.1.1'), true);

  let transportCalled = false;

  const resolver = async () => [
    { address: '8.8.8.8', family: 4 },
    { address: '127.0.0.1', family: 4 }
  ];

  const transport = (() => {
    transportCalled = true;
    throw new Error('TRANSPORT_MUST_NOT_RUN');
  }) as any;

  await assert.rejects(
    secureFeedFetch(
      'https://example.com/feed.xml',
      resolver as any,
      transport
    ),
    /UNSAFE_FEED_DNS/
  );

  assert.equal(transportCalled, false);

  console.log('PASS: Special-use addresses rejected');
  console.log('PASS: Public IPv4 addresses accepted');
  console.log('PASS: Mixed DNS answers rejected');
  console.log('PASS: Unsafe DNS never reaches transport');
  console.log('DNS EDGE SECURITY SUITE: ALL PASSED');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
