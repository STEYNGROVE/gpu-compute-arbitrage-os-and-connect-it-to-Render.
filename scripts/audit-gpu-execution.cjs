// Read-only architecture audit. Does not enable purchasing, connect to suppliers or spend credits.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const exists = p => fs.existsSync(path.join(root,p));
const findings=[];
function check(id,pass,detail,severity='critical') {findings.push({id,pass,detail,severity});}
const server=read('server.ts');
const policy=read('server/creditSpendPolicy.ts');
const gate=read('server/prepaidReservationGate.ts');
const vast=read('server/providers/vastProvider.ts');
const runpod=read('server/providers/runpodProvider.ts');
const provisioner=read('server/providerProvisioner.ts');
check('HTTP_423_LOCK',server.includes('FINANCIAL_EXECUTION_DISABLED_PHASE_2_3'),'Sensitive-route blocker marker must remain');
check('PER_JOB_CAP',policy.includes('estimatedGpuCostUsd > 2'),'Pilot cap $2 per job');
check('DAILY_CAP',policy.includes('todayCommittedUsd + job.estimatedGpuCostUsd > 5'),'Pilot cap $5 per day');
check('CONCURRENT_LIMIT',policy.includes('concurrentPaidJobs !== 0'),'One paid job at a time');
check('AUTO_TOPUP_OFF',policy.includes('!job.cardAutoTopupDisabled'),'Require auto top-up disabled');
check('PAYMENT_VERIFIED',policy.includes('!job.customerPaymentVerified'),'Payment evidence required');
check('OWNER_APPROVAL',policy.includes('!job.ownerApproved'),'Owner approval required');
check('RESERVATION_DEFAULT_DISABLED',gate.includes("process.env.GPU_PURCHASING_ENABLED !== 'true'"),'Reservation must fail closed by default');
check('EVIDENCE_DEFAULT_DISABLED',gate.includes("process.env.GPU_EVIDENCE_VERIFIER_READY !== 'true'"),'Evidence verification must fail closed');
check('PUBLIC_RESERVATION_NOT_AUTHORIZED',gate.includes('EXTERNAL_EVIDENCE_VERIFICATION_NOT_IMPLEMENTED'),'Public reservation entry must reject until evidence integration');
check('TRANSACTION_LOCK',gate.includes('pg_advisory_xact_lock'),'Database reservations serialize');
check('RESERVATION_MIGRATION',exists('scripts/sql/20261108_prepaid_reservations.sql'),'SQL migration exists');
check('SUPPLIER_DIAGNOSTICS',exists('server/supplierReadOnlyDiagnostics.ts'),'Read-only diagnostics exist');
// Known architectural blockers: report, never pretend they are fixed.
check('SINGLE_AUTHORIZED_PURCHASE_GATE',false,'Direct purchase implementation still exists in server/providerProvisioner.ts; all purchase paths require audited reservation enforcement','blocker');
check('VERIFIED_BALANCE_ADAPTER',false,'No trusted, fresh supplier balance evidence adapter is verified end-to-end','blocker');
check('PROVIDER_KILL_SWITCH',false,'No independently tested cost/time-based instance termination and reconciliation','blocker');

// Re-run the real isolated PostgreSQL test when explicitly requested.
let postgresVerified = false;
let postgresDetail = 'Real isolated PostgreSQL test not executed';

if (process.env.RUN_GPU_POSTGRES_AUDIT === 'YES') {
  const { spawnSync } = require('node:child_process');
  const url = process.env.TEST_DATABASE_URL;

  try {
    if (!url) throw Error('TEST_DATABASE_URL_REQUIRED');

    const parsed = new URL(url);
    const dbName = decodeURIComponent(parsed.pathname.slice(1));

    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname))
      throw Error('LOCALHOST_ONLY');

    if (!/(test|sandbox|scratch)/i.test(dbName))
      throw Error('TEST_DATABASE_REQUIRED');

    if (process.env.ALLOW_ISOLATED_GPU_DB_TEST !== 'YES')
      throw Error('EXPLICIT_OPT_IN_REQUIRED');

    if (process.env.RENDER || process.env.NODE_ENV === 'production')
      throw Error('DEPLOYMENT_ENVIRONMENT_REFUSED');

    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.RENDER;

    const result = spawnSync(
      process.execPath,
      [require.resolve('tsx/cli'), 'test/prepaidPostgresIntegrationSuite.ts'],
      {
        cwd: root,
        env: { ...env, NODE_ENV: 'test', DISABLE_JSON_PERSISTENCE: 'true' },
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 1024 * 1024
      }
    );

    const marker = 'PASS: isolated PostgreSQL schema migration, public fail-closed, concurrent serialization, duplicate prevention, active-job limit, rollback and recovery';

    postgresVerified = result.status === 0 &&
      !result.error &&
      result.stdout.includes(marker) &&
      !result.stdout.includes('SKIP:');

    postgresDetail = postgresVerified
      ? 'Fresh isolated PostgreSQL concurrency and rollback test passed'
      : 'PostgreSQL integration test failed or did not prove execution';

  } catch (err) {
    postgresDetail = 'PostgreSQL audit setup rejected: ' + err.message;
  }
}

check('REAL_DB_CONCURRENCY_TEST',
  postgresVerified, postgresDetail, 'blocker');

check('PAYMENT_EVIDENCE_ADAPTER',false,'No independently verified prepaid customer payment adapter','blocker');
const report={generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_PURCHASES',safeControlsPassed:findings.filter(f=>f.severity==='critical'&&f.pass).length,safeControlsFailed:findings.filter(f=>f.severity==='critical'&&!f.pass).length,remainingBlockers:findings.filter(f=>f.severity==='blocker'&&!f.pass).length,findings};
console.log(JSON.stringify(report,null,2));
if (
  process.argv.includes('--strict') &&
  (report.safeControlsFailed > 0 || report.remainingBlockers > 0)
) {
  console.error(
    'COMMERCIAL_LAUNCH_BLOCKED: unresolved safety or integration gates'
  );
  process.exitCode = 1;
}
