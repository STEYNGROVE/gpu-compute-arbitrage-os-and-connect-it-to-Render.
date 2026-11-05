const fs = require('node:fs');
const assert = require('node:assert/strict');

const worker = fs.readFileSync(
  'server/outboxWorker.ts', 'utf8'
);

const repo = fs.readFileSync(
  'server/repositories/operationJobSettlementOutboxRepo.ts',
  'utf8'
);

let passed = 0;

function check(name, fn) {
  fn();
  passed++;
  console.log(`PASS: ${name}`);
}

const processor = worker.split(
  'private async processEvent('
)[1]?.split(
  'private async handleProvisionGpuInstance('
)[0];

assert.ok(processor, 'Event processor not found');

check('Central guard precedes PROCESSING update', () => {
  const guard = processor.indexOf(
    'assertLiveOperationsAllowed();'
  );
  const processing = processor.indexOf(
    "status = 'PROCESSING'"
  );

  assert.ok(guard >= 0);
  assert.ok(processing > guard);
});

check('Success path occurs after event dispatch', () => {
  assert.ok(
    processor.indexOf('switch (event.eventType)') <
    processor.indexOf('markProcessed(eventId, true)')
  );
});

check('Failure path records the error', () => {
  assert.match(
    processor,
    /markProcessed\(eventId, false, err\.message\)/
  );
});

check('Lockdown failures map to DEAD_LETTER', () => {
  assert.match(
    repo,
    /WHEN \$2 LIKE 'SIMULATION_LOCKDOWN:%' THEN 'DEAD_LETTER'/
  );
});

check('Worker does not claim DEAD_LETTER events', () => {
  const claim = repo.split(
    'public async claimPendingEvents('
  )[1]?.split(
    'public async markProcessed('
  )[0];

  assert.ok(claim);
  assert.match(claim, /status = 'PENDING'/);
  assert.match(claim, /status = 'CLAIMED'/);
  assert.match(claim, /status NOT IN \('SUCCEEDED', 'DEAD_LETTER'\)/);
});

check('No unconditional batch success timestamp', () => {
  const polling = worker.split(
    'public async pollAndExecute('
  )[1]?.split(
    'private async processEvent('
  )[0];

  assert.ok(polling);
  assert.doesNotMatch(
    polling,
    /this\.lastSuccessAt\s*=\s*new Date\(\)/
  );
});

console.log(`RESULT: ${passed}/6 static checks passed`);
