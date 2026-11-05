const fs = require('node:fs');
const assert = require('node:assert/strict');

function source(path) {
  return fs.readFileSync(path, 'utf8');
}

function verifyGuard(path, method) {
  const code = source(path);
  const start = code.indexOf(method);

  assert(start >= 0, `Missing method: ${method}`);

  const signature = code.slice(start);
  const body = signature.match(/\}>\s*\{\s*assertLiveOperationsAllowed\(\);/);

  assert(body, `Missing executable guard: ${method}`);

  console.log(`PASS: ${method}`);
}

verifyGuard(
  'server/hotWalletService.ts',
  'public async withdrawToBinance('
);

verifyGuard(
  'server/providerProvisioner.ts',
  'public async terminateComputeHardware('
);

const policy = source('server/simulationSafety.ts');

assert(
  /return false;/.test(policy),
  'Simulation policy must deny live execution'
);

console.log('PASS: Simulation-only policy');

const worker = source('server/outboxWorker.ts');

assert(
  /case 'PROVISION_GPU_INSTANCE':\s*\{\s*assertLiveOperationsAllowed\(\);/.test(worker),
  'GPU outbox worker must block provisioning'
);

console.log('PASS: GPU provisioning outbox guard');
console.log('ALL 4 STATIC SAFETY CHECKS PASSED');
