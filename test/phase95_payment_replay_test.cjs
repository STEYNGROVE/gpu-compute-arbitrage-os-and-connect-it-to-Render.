'use strict';
// Optional isolated integration test: TEST_DATABASE_URL must point to a disposable local database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = fs.readFileSync('migrations/20261109_payment_evidence_replay.sql', 'utf8');
for (const term of ['UNIQUE (provider, provider_transaction_id)', 'UNIQUE (order_id)', 'PAYMENT_ALLOCATION_IMMUTABLE', 'amount_minor > 0']) assert.ok(sql.includes(term), term);
console.log('PASS: Phase 9.5 migration static safety assertions (not a database concurrency test)');
if (process.env.ALLOW_ISOLATED_GPU_DB_TEST !== 'YES') {
  console.log('SKIP: isolated PostgreSQL integration (set ALLOW_ISOLATED_GPU_DB_TEST=YES and TEST_DATABASE_URL)');
  process.exit(0);
}
const url = process.env.TEST_DATABASE_URL || '';
const parsed = new URL(url);
assert.ok(['localhost','127.0.0.1','::1'].includes(parsed.hostname), 'Only local disposable PostgreSQL allowed');
assert.ok(/test/i.test(parsed.pathname), 'Database name must include test');
const { Client } = require('pg');
(async()=>{
 const client = new Client({connectionString:url}); await client.connect();
 try {
  await client.query(sql);
  const tx = 'phase95test'+Date.now();
  const values = ['TEST',tx,'test-customer','test-order-'+tx,100,'USD','a'.repeat(64)];
  const insert = 'INSERT INTO gpu_payment_evidence_allocations (provider,provider_transaction_id,customer_id,order_id,amount_minor,currency,evidence_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7)';
  await client.query(insert,values);
  await assert.rejects(client.query(insert,['TEST',tx,'other-customer','other-order-'+tx,100,'USD','a'.repeat(64)]),e=>e.code==='23505');
  await assert.rejects(client.query(insert,['TEST',tx+'other','test-customer','test-order-'+tx,100,'USD','a'.repeat(64)]),e=>e.code==='23505');
  await assert.rejects(client.query('DELETE FROM gpu_payment_evidence_allocations WHERE provider=$1 AND provider_transaction_id=$2',['TEST',tx]),e=>e.message.includes('PAYMENT_ALLOCATION_IMMUTABLE'));
  console.log('PASS: isolated database uniqueness and immutability');
 } finally { await client.end(); }
})().catch(e=>{console.error(e);process.exitCode=1});
