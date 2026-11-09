'use strict';
// Disposable local PostgreSQL ONLY. No production DB, no payment authorization.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { URL } = require('node:url');

async function main() {
  assert.equal(process.env.ALLOW_ISOLATED_GPU_DB_TEST, 'YES', 'Explicit opt-in required');
  assert.ok(!process.env.RENDER && process.env.NODE_ENV !== 'production', 'Deployment environment forbidden');
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL required');
  const u = new URL(url);
  assert.equal(u.protocol, 'postgresql:');
  assert.ok(['localhost','127.0.0.1'].includes(u.hostname), 'Local database only');
  assert.equal(u.port, '55439', 'Dedicated test port required');
  assert.equal(u.pathname, '/gpu_commercial_test', 'Dedicated test database required');
  assert.notEqual(url, process.env.DATABASE_URL, 'Production URL forbidden');
  assert.ok(!u.searchParams.has('host'), 'No alternate host parameter');
  const schema = 'phase95_' + crypto.randomBytes(8).toString('hex');
  const admin = new Client({ connectionString:url });
  const clients = [];
  const connect = async () => {
    const c = new Client({connectionString:url}); await c.connect();
    await c.query(`SET search_path TO "${schema}"`);
    clients.push(c); return c;
  };
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const setup = await connect();
    const migration = fs.readFileSync('migrations/20261109_payment_evidence_replay.sql','utf8');
    await setup.query(migration);
    const insert = `INSERT INTO gpu_payment_evidence_allocations
      (provider,provider_transaction_id,customer_id,order_id,amount_minor,currency,evidence_sha256)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`;
    const vals = (tx,order) => ['TEST',tx,'customer-one',order,1500,'USD','a'.repeat(64)];
    const a = await connect(), b = await connect();
    const tx = 'concurrent-'+crypto.randomBytes(6).toString('hex');
    const attempts = await Promise.allSettled([
      a.query(insert,vals(tx,'order-A-'+tx)),
      b.query(insert,vals(tx,'order-B-'+tx))
    ]);
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1,'Exactly one concurrent insert succeeds');
    assert.equal(attempts.filter(x=>x.status==='rejected' && x.reason.code==='23505').length,1,'Other concurrent insert fails unique constraint');
    console.log('PASS: concurrent duplicate transaction rejected');
    const tx2='distinct-'+crypto.randomBytes(6).toString('hex');
    const winner = await setup.query(
      'SELECT order_id FROM gpu_payment_evidence_allocations WHERE provider_transaction_id=$1',
      [tx]
    );
    assert.equal(winner.rows.length, 1);
    await assert.rejects(
      b.query(insert, vals(tx2, winner.rows[0].order_id)),
      e => e.code === '23505'
    );
    console.log('PASS: duplicate order rejected');
    await assert.rejects(a.query('UPDATE gpu_payment_evidence_allocations SET amount_minor=1 WHERE provider_transaction_id=$1',[tx]),e=>e.message.includes('PAYMENT_ALLOCATION_IMMUTABLE'));
    await assert.rejects(a.query('DELETE FROM gpu_payment_evidence_allocations WHERE provider_transaction_id=$1',[tx]),e=>e.message.includes('PAYMENT_ALLOCATION_IMMUTABLE'));
    console.log('PASS: UPDATE and DELETE rejected');
    const count=await setup.query('SELECT COUNT(*)::int AS n FROM gpu_payment_evidence_allocations');
    assert.equal(count.rows[0].n,1);
    console.log('PASS: exactly one allocation row remains');
    console.log('PASS: isolated PostgreSQL Phase 9.5 concurrency suite');
  } finally {
    for (const c of clients) await c.end().catch(()=>{});
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>{});
    await admin.end();
  }
}
main().catch(e=>{console.error('FAIL:',e);process.exitCode=1;});
