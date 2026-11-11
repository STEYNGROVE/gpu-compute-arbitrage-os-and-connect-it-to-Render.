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
check('REAL_DB_CONCURRENCY_TEST',false,'Isolated reservation concurrency tests exist; full financial repositories, crash recovery and migration upgrade/replay remain uncertified','blocker');
check('PAYMENT_EVIDENCE_ADAPTER',false,'No independently verified prepaid customer payment adapter','blocker');
const report={generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_PURCHASES',safeControlsPassed:findings.filter(f=>f.severity==='critical'&&f.pass).length,safeControlsFailed:findings.filter(f=>f.severity==='critical'&&!f.pass).length,remainingBlockers:findings.filter(f=>f.severity==='blocker').length,findings};
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
