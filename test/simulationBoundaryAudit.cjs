const fs = require('node:fs');
const assert = require('node:assert/strict');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const policy = read('server/simulationSafety.ts');
const binance = read('server/binanceProvider.ts');
const funding = read('server/providerFundingAdapters.ts');
const wallet = read('server/hotWalletService.ts');
const gpu = read('server/providerProvisioner.ts');

const checks = [
  [
    'Central simulation policy denies live execution',
    () => assert.match(policy, /return false;/)
  ],
  [
    'Binance request handler rejects writes',
    () => assert.match(
      binance,
      /if \(method !== 'GET'\)\s*\{\s*throw new Error/
    )
  ],
  [
    'Funding manager has central guard',
    () => assert.match(
      funding,
      /Promise<ProviderFundingEventRecord>\s*\{\s*assertLiveOperationsAllowed\(\)/
    )
  ],
  [
    'Blockchain RPC rejects transaction broadcasts',
    () => assert.match(
      wallet,
      /private async jsonRpcCall[\s\S]*?if \(\/\^eth_send/
    )
  ],
  [
    'GPU provisioning has central guard',
    () => assert.match(
      gpu,
      /public async provisionComputeHardware[\s\S]*?\{\s*assertLiveOperationsAllowed\(\)/
    )
  ],
  [
    'GPU termination has central guard',
    () => assert.match(
      gpu,
      /public async terminateComputeHardware[\s\S]*?\{\s*assertLiveOperationsAllowed\(\)/
    )
  ]
];

let failed = 0;

for (const [name, check] of checks) {
  try {
    check();
    console.log('PASS:', name);
  } catch (error) {
    failed++;
    console.error('FAIL:', name);
    console.error(error.message);
  }
}

console.log(
  `RESULT: ${checks.length - failed}/${checks.length} static checks passed`
);

if (failed) process.exitCode = 1;
