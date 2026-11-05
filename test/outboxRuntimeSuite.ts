import assert from 'node:assert/strict';

process.env.SYSTEM_OPERATING_MODE = 'SIMULATION';
process.env.EXECUTION_MODE = 'SIMULATION';
process.env.REALITY_LEVEL = 'SIMULATION';
process.env.BINANCE_ENABLED = 'false';
process.env.BINANCE_WITHDRAWALS_ENABLED = 'false';

async function main() {
  const { OutboxWorker } = await import('../server/outboxWorker.js');
  const { pgDbService } = await import('../server/pgDatabase.js');
  const { outboxRepo } = await import('../server/repositories/index.js');
  const { hardwareProvisioner } = await import('../server/providerProvisioner.js');

  const originalQuery = pgDbService.query;
  const originalMark = outboxRepo.markProcessed;
  const originalProvision = hardwareProvisioner.provisionComputeHardware;

  let databaseWrites = 0;
  let providerCalls = 0;
  const results: Array<{
    id: string;
    success: boolean;
    error?: string;
  }> = [];

  try {
    pgDbService.query = (async () => {
      databaseWrites++;
      throw new Error('TEST_FAILURE: Database access attempted');
    }) as typeof pgDbService.query;

    hardwareProvisioner.provisionComputeHardware = (async () => {
      providerCalls++;
      throw new Error('TEST_FAILURE: Provider called');
    }) as typeof hardwareProvisioner.provisionComputeHardware;

    outboxRepo.markProcessed = (async (
      id: string,
      success: boolean,
      error?: string
    ) => {
      results.push({ id, success, error });
    }) as typeof outboxRepo.markProcessed;

    const worker = new OutboxWorker();

    const events = [
      'PROVISION_GPU_INSTANCE',
      'RECONCILE_TREASURY',
      'EMERGENCY_KILL_SWITCH_SYNC',
      'UNKNOWN_EVENT'
    ];

    for (const [index, eventType] of events.entries()) {
      await (worker as any).processEvent({
        id: `isolated-${index}`,
        eventType,
        payload: {}
      });

      const result = results[index];

      assert.ok(result, `${eventType}: missing failure record`);
      assert.equal(result.success, false);
      assert.match(result.error || '', /SIMULATION_LOCKDOWN/);

      console.log(`PASS: ${eventType} rejected`);
    }

    assert.equal(databaseWrites, 0);
    console.log('PASS: No PROCESSING database updates');

    assert.equal(providerCalls, 0);
    console.log('PASS: No GPU provider provisioning calls');

    assert.equal(results.length, events.length);
    assert.ok(results.every(result => !result.success));
    console.log('PASS: No events marked successful');

    console.log('RESULT: 7/7 runtime assertions passed');
  } finally {
    pgDbService.query = originalQuery;
    outboxRepo.markProcessed = originalMark;
    hardwareProvisioner.provisionComputeHardware = originalProvision;
  }
}

main().catch(error => {
  console.error('RUNTIME TEST FAILED:', error);
  process.exitCode = 1;
});
