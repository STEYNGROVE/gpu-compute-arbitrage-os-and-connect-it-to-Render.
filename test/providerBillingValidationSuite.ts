import assert from 'node:assert/strict';
import { RunpodProvider } from '../server/providers/runpodProvider.js';
import { VastAiProvider } from '../server/providers/vastProvider.js';

const originalFetch = globalThis.fetch;
const originalRunpodKey = process.env.RUNPOD_API_KEY;
const originalVastKey = process.env.VAST_API_KEY;

process.env.RUNPOD_API_KEY = 'synthetic-test-key';
process.env.VAST_API_KEY = 'synthetic-test-key';

const providers = [
  {
    name: 'RunPod',
    instance: new RunpodProvider(),
    url: 'https://api.runpod.io/graphql',
    response: (value: unknown) => ({
      data: { myself: { id: 'test-user', clientBalance: value } }
    })
  },
  {
    name: 'Vast.ai',
    instance: new VastAiProvider(),
    url: 'https://console.vast.ai/api/v0/users/current/',
    response: (value: unknown) => ({
      id: 'test-user',
      username: 'private-user',
      email: 'private@example.test',
      credit: value
    })
  }
];

let cases = 0;

try {
  for (const provider of providers) {
    for (const [label, value, expected] of [
      ['positive', 15.75, 15.75],
      ['zero', 0, 0],
      ['missing', undefined, null],
      ['string', '15', null],
      ['negative', -1, null],
      ['infinite', Infinity, null],
      ['NaN', NaN, null],
      ['oversized', 100000000, null]
    ] as const) {
      globalThis.fetch = (async (input, options) => {
        assert.equal(String(input), provider.url);
        assert.ok(options?.signal);
        return {
          ok: true,
          json: async () => provider.response(value)
        } as Response;
      }) as typeof fetch;

      const billing = await provider.instance.getBilling();

      assert.equal(
        billing.accountBalanceUsd,
        expected,
        `${provider.name}: ${label} account balance`
      );

      assert.equal(
        billing.creditRemainingUsd,
        expected,
        `${provider.name}: ${label} remaining credit`
      );

      const raw = JSON.stringify(billing);
      assert.ok(
        !raw.includes('private@example.test') &&
        !raw.includes('private-user'),
        `${provider.name}: personal data exposed`
      );

      cases++;
    }

    globalThis.fetch = (async () => ({
      ok: false,
      status: 401
    } as Response)) as typeof fetch;

    const unauthorized = await provider.instance.getBilling();
    assert.equal(unauthorized.accountBalanceUsd, null);
    cases++;

    globalThis.fetch = (async () => {
      throw new Error('Synthetic network failure');
    }) as typeof fetch;

    const networkFailure = await provider.instance.getBilling();
    assert.equal(networkFailure.accountBalanceUsd, null);
    cases++;
  }

  console.log(
    `PASS: ${cases} direct provider billing validation cases; no live supplier requests`
  );
} finally {
  globalThis.fetch = originalFetch;

  if (originalRunpodKey === undefined)
    delete process.env.RUNPOD_API_KEY;
  else
    process.env.RUNPOD_API_KEY = originalRunpodKey;

  if (originalVastKey === undefined)
    delete process.env.VAST_API_KEY;
  else
    process.env.VAST_API_KEY = originalVastKey;
}
