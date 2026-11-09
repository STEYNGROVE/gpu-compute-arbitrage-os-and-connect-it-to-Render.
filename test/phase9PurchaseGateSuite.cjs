const assert = require('node:assert/strict');
const fs = require('node:fs');

const worker = fs.readFileSync(
  'server/outboxWorker.ts', 'utf8'
);

const provisioner = fs.readFileSync(
  'server/providerProvisioner.ts', 'utf8'
);

const handler = worker.indexOf(
  'private async handleProvisionGpuInstance('
);

const workerLock = worker.indexOf(
  "throw new Error('GPU_PURCHASE_GATE_BLOCKED:",
  handler
);

const workerProviderCall = worker.indexOf(
  'hardwareProvisioner.provisionComputeHardware(',
  handler
);

assert(handler >= 0, 'Worker handler missing');
assert(workerLock > handler, 'Worker lock missing');
assert(
  workerLock < workerProviderCall,
  'Worker lock must precede provider call'
);

const method = provisioner.indexOf(
  'public async provisionComputeHardware('
);

const directLock = provisioner.indexOf(
  "throw new Error('DIRECT_GPU_PURCHASE_BLOCKED:",
  method
);

const livePurchase = provisioner.indexOf(
  '// --- LIVE MODE: ACTUAL HARDWARE PURCHASE ---',
  method
);

assert(method >= 0, 'Provider method missing');
assert(directLock > method, 'Direct purchase lock missing');
assert(
  directLock < livePurchase,
  'Direct purchase lock must precede legacy purchase code'
);


// Ensure the worker guard is unconditional and first.
const handlerBody = worker.slice(
  worker.indexOf('{', handler) + 1,
  workerProviderCall
);

const withoutComments = handlerBody
  .replace(/\/\/[^\n]*/g, '')
  .trimStart();

assert(
  withoutComments.startsWith(
    "throw new Error('GPU_PURCHASE_GATE_BLOCKED:"
  ),
  'Worker purchase guard must be the first executable statement'
);

console.log('PASS: Phase 9 source-level purchase locks');
