import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { reserveVerifiedCredit, reservePrepaidCredit } from '../server/prepaidReservationGate.js';

const url=process.env.TEST_DATABASE_URL;
if (!url) { console.error('SKIP: TEST_DATABASE_URL not supplied; no database contacted'); process.exit(0); }
if (process.env.DATABASE_URL && url === process.env.DATABASE_URL) throw Error('REFUSE_PRODUCTION_DATABASE_URL');
if (process.env.RENDER || process.env.NODE_ENV === 'production') throw Error('REFUSE_DEPLOYMENT_ENVIRONMENT');
if (process.env.ALLOW_ISOLATED_GPU_DB_TEST !== 'YES') throw Error('EXPLICIT_TEST_OPT_IN_REQUIRED');
const dbName=new URL(url).pathname.split('/').filter(Boolean).pop() || '';
if (!/(test|sandbox|scratch)/i.test(dbName)) throw Error('DATABASE_NAME_MUST_INDICATE_TEST_OR_SANDBOX');
const schema='gpu_test_'+randomBytes(8).toString('hex');
const admin=new Pool({connectionString:url,max:2,connectionTimeoutMillis:5000});
let isolated:Pool|undefined;
const oldPurchase=process.env.GPU_PURCHASING_ENABLED;
const oldEvidence=process.env.GPU_EVIDENCE_VERIFIER_READY;
const job=(id:string, provider: 'vast_ai' | 'runpod' = 'vast_ai')=>({
  jobId:id,customerPaymentEvidenceId:'payment_12345678',
  providerBalanceEvidenceId:'balance_12345678',ownerApprovalEvidenceId:'approval_12345678',
  job:{provider,customerPaymentVerified:true,customerPaymentUsd:2,
    estimatedGpuCostUsd:1,availablePrepaidCreditUsd:10,todayCommittedUsd:0,
    concurrentPaidJobs:0,cardAutoTopupDisabled:true,ownerApproved:true}
});
const count=async()=>Number((await isolated!.query('SELECT COUNT(*)::int AS n FROM gpu_prepaid_reservations')).rows[0].n);
try {
  await admin.query('SELECT 1');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  // Dedicated schema and explicit search_path keep all test writes isolated.
  isolated=new Pool({connectionString:url,max:4,connectionTimeoutMillis:5000,
    options:`-c search_path=${schema}`});
  const sql=readFileSync('scripts/sql/20261108_prepaid_reservations.sql','utf8');
  await isolated.query(sql);
  assert.equal(await count(),0);
  process.env.GPU_PURCHASING_ENABLED='true';
  process.env.GPU_EVIDENCE_VERIFIER_READY='true';
  const publicDecision=await reservePrepaidCredit(isolated,job('public_12345678'));
  assert.equal(publicDecision.reserved,false,'Public path must fail closed');
  const [a,b]=await Promise.all([
    reserveVerifiedCredit(isolated,job('concurrent_12345678'),1000,200),
    reserveVerifiedCredit(isolated,job('concurrent_87654321'),1000,200)
  ]);
  assert.equal([a,b].filter(x=>x.reserved).length,1,'Exactly one concurrent reservation succeeds');
  assert.equal(await count(),1);
  const dup=await reserveVerifiedCredit(isolated,job(a.reserved?'concurrent_12345678':'concurrent_87654321'),1000,200);
  assert.equal(dup.reason,'DUPLICATE_JOB');
  const next=await reserveVerifiedCredit(isolated,job('another_12345678'),1000,200);
  assert.equal(next.reason,'CONCURRENCY_LIMIT');
  // A deliberate SQL trigger failure must roll back without persisting the reservation.
  await isolated.query("UPDATE gpu_prepaid_reservations SET status='CANCELLED'");
  await isolated.query(`CREATE FUNCTION reject_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_INSERT_FAILURE'; END; $$`);
  await isolated.query(`CREATE TRIGGER fail_insert BEFORE INSERT ON gpu_prepaid_reservations FOR EACH ROW EXECUTE FUNCTION reject_insert()`);
  const failed=await reserveVerifiedCredit(isolated,job('rollback_12345678'),1000,200);
  assert.equal(failed.reason,'DATABASE_RESERVATION_FAILED');
  assert.equal(await count(),1,'Failed transaction must not persist new row');
  await isolated.query('DROP TRIGGER fail_insert ON gpu_prepaid_reservations');
  await isolated.query('DROP FUNCTION reject_insert()');
  const resumed=await reserveVerifiedCredit(isolated,job('resumed_12345678'),1000,200);
  assert.equal(resumed.reserved,true,'Connection and transaction recover after rollback');
  assert.equal(await count(),2);
  await isolated.query("UPDATE gpu_prepaid_reservations SET status='CANCELLED'");
  const crossProvider = job('crossprov_12345678', 'runpod');
  const cross = await Promise.all([
    reserveVerifiedCredit(isolated, job('crossvast_12345678'), 1000, 200),
    reserveVerifiedCredit(isolated, crossProvider, 1000, 200)
  ]);
  assert.equal(cross.filter(x => x.reserved).length, 1, 'Concurrency limit spans providers');
  await isolated.query("UPDATE gpu_prepaid_reservations SET status='CANCELLED'");
  const capJob = job('jobcap_12345678');
  capJob.job.estimatedGpuCostUsd = 2.01;
  assert.equal((await reserveVerifiedCredit(isolated, capJob, 1000, 300)).reason, 'PER_JOB_CAP_EXCEEDED');
  const insufficient = job('lowbalance_12345678');
  assert.equal((await reserveVerifiedCredit(isolated, insufficient, 99, 200)).reason, 'INSUFFICIENT_VERIFIED_CREDIT');
  // UTC day accounting must include settled jobs while excluding cancelled and prior-day rows.
  await isolated.query(`INSERT INTO gpu_prepaid_reservations
    (job_id,provider,estimated_cost_cents,customer_payment_evidence_id,provider_balance_evidence_id,owner_approval_evidence_id,status)
    VALUES ('daily_fixture_1','vast_ai',200,'payment_fixture','balance_fixture','approval_fixture','SETTLED'),
           ('daily_fixture_2','runpod',200,'payment_fixture','balance_fixture','approval_fixture','SETTLED')`);
  const dailyJob = job('dailycap_12345678');
  dailyJob.job.estimatedGpuCostUsd = 1.01;
  assert.equal((await reserveVerifiedCredit(isolated, dailyJob, 1000, 300)).reason, 'DAILY_CAP_EXCEEDED');
  await isolated.query("UPDATE gpu_prepaid_reservations SET created_at = date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - interval '1 second' WHERE status='SETTLED'");
  assert.equal((await reserveVerifiedCredit(isolated, dailyJob, 1000, 300)).reserved, true, 'Prior UTC day is excluded');
  console.log('PASS: isolated PostgreSQL reservation serialization across providers, duplicates, rollback/recovery, per-job/daily caps, UTC accounting and insufficient balance');
} finally {
  if(oldPurchase===undefined) delete process.env.GPU_PURCHASING_ENABLED; else process.env.GPU_PURCHASING_ENABLED=oldPurchase;
  if(oldEvidence===undefined) delete process.env.GPU_EVIDENCE_VERIFIER_READY; else process.env.GPU_EVIDENCE_VERIFIER_READY=oldEvidence;
  await isolated?.end();
  try { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } finally {await admin.end();}
}
